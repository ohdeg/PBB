package com.studiobs.spring_backend.domain.tempori;

import com.studiobs.spring_backend.global.exception.BusinessException;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.apache.pdfbox.Loader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;

@Component
public class TemporiFileValidator {
    public record Validated(byte[] bytes, String format, String sha256) {}
    public Validated validate(MultipartFile file, long maximum) {
        try {
            if(file.isEmpty() || file.getSize()>maximum) throw invalid("파일은 25 MiB 이하여야 합니다.");
            byte[] bytes;
            try(var input=file.getInputStream()) { bytes=bounded(input, maximum); }
            String format;
            if(bytes.length>=5 && new String(bytes,0,5,StandardCharsets.US_ASCII).equals("%PDF-")) {
                try(var pdf=Loader.loadPDF(bytes)) {
                    if(pdf.isEncrypted() || pdf.getNumberOfPages()==0) throw invalid("암호화되거나 빈 PDF는 지원하지 않습니다.");
                    // Force page dictionaries to be read, not just the trailer.
                    for(var page:pdf.getPages()) if(page.getMediaBox().getWidth()<=0 || page.getMediaBox().getHeight()<=0) throw invalid("손상된 PDF입니다.");
                }
                format="pdf";
            } else if(bytes.length>=4 && bytes[0]==0x50 && bytes[1]==0x4b && bytes[2]==3 && bytes[3]==4) {
                validateZip(bytes); format="mxl";
            } else { scoreXml(bytes); format="musicxml"; }
            return new Validated(bytes,format,hash(bytes));
        } catch(BusinessException e) { throw e; }
        catch(Exception e) { throw invalid("PDF 또는 MusicXML/MXL 원본을 확인해 주세요. 암호화·손상 파일은 지원하지 않습니다."); }
    }
    static byte[] bounded(InputStream input,long maximum) throws IOException {
        var out=new ByteArrayOutputStream(); byte[] buffer=new byte[8192]; int count; long size=0;
        while((count=input.read(buffer))!=-1) { size+=count; if(size>maximum) throw invalid("파일 용량 제한을 초과했습니다."); out.write(buffer,0,count); }
        return out.toByteArray();
    }
    private void validateZip(byte[] bytes) throws Exception {
        // ZipInputStream alone accepts archives missing their central directory.
        var temporary=java.nio.file.Files.createTempFile("tempori-validate-", ".zip");
        int centralCount;
        try {
            java.nio.file.Files.write(temporary,bytes);
            try(var central=new ZipFile(temporary.toFile())) { centralCount=central.size(); if(centralCount>1000) throw invalid("압축 파일 항목이 너무 많습니다."); }
        } finally { java.nio.file.Files.deleteIfExists(temporary); }
        Map<String,byte[]> entries=new HashMap<>(); long total=0; int count=0;
        try(var zip=new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while((entry=zip.getNextEntry())!=null) {
                if(++count>1000) throw invalid("압축 파일 항목이 너무 많습니다.");
                String path=entry.getName();
                if(path.startsWith("/") || path.contains("\\") || Arrays.asList(path.split("/")).contains("..") || path.matches("^[A-Za-z]:.*")) throw invalid("잘못된 압축 경로입니다.");
                byte[] data=bounded(zip,100L*1024*1024-total); total+=data.length;
                if(!entry.isDirectory() && entries.putIfAbsent(path,data)!=null) throw invalid("중복 압축 경로입니다.");
            }
        }
        if(count!=centralCount) throw invalid("손상된 압축 파일입니다.");
        String root=null;
        if(entries.containsKey("META-INF/container.xml")) {
            var document=parseXml(entries.get("META-INF/container.xml"));
            var roots=document.getElementsByTagName("rootfile");
            if(roots.getLength()>0) root=((org.w3c.dom.Element)roots.item(0)).getAttribute("full-path");
            if(root==null || !entries.containsKey(root)) throw invalid("MusicXML 원본이 없습니다.");
        }
        if(root!=null) scoreXml(entries.get(root));
        else {
            boolean found=false;
            for(var item:entries.entrySet()) if(!item.getKey().startsWith("META-INF/") && item.getKey().toLowerCase(Locale.ROOT).matches(".*\\.(xml|musicxml)$")) {
                scoreXml(item.getValue()); found=true; break;
            }
            if(!found) throw invalid("MusicXML 원본이 없습니다.");
        }
    }
    private Document parseXml(byte[] data) throws Exception {
        String xml=new String(data,StandardCharsets.UTF_8);
        if(xml.matches("(?is).*<!DOCTYPE[^>]*\\[.*") || xml.matches("(?is).*<!ENTITY.*")) throw invalid("내부 DTD 또는 엔티티는 지원하지 않습니다.");
        var factory=DocumentBuilderFactory.newInstance(); factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING,true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",false);
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd",false);
        factory.setFeature("http://xml.org/sax/features/external-general-entities",false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities",false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD,""); factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");
        factory.setXIncludeAware(false); factory.setExpandEntityReferences(false);
        var builder=factory.newDocumentBuilder();
        builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler() { @Override public void fatalError(org.xml.sax.SAXParseException error) throws org.xml.sax.SAXException { throw error; } });
        Document parsed=builder.parse(new ByteArrayInputStream(data));
        if(parsed.getDoctype()!=null && parsed.getDoctype().getInternalSubset()!=null && !parsed.getDoctype().getInternalSubset().isBlank()) throw invalid("내부 DTD는 지원하지 않습니다.");
        return parsed;
    }
    private void scoreXml(byte[] data) throws Exception {
        String root=parseXml(data).getDocumentElement().getLocalName();
        if(!"score-partwise".equals(root) && !"score-timewise".equals(root)) throw invalid("MusicXML 악보가 아닙니다.");
    }
    static String hash(byte[] bytes) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); } catch(Exception e) { throw new IllegalStateException(e); } }
    static BusinessException invalid(String message) { return new BusinessException(HttpStatus.BAD_REQUEST,message); }
}
