package com.studiobs.spring_backend.domain.tempori;

import static org.junit.jupiter.api.Assertions.*;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class TemporiFileValidatorTest {
    private final TemporiFileValidator validator = new TemporiFileValidator();
    private final byte[] xml = "<?xml version=\"1.0\"?><score-partwise><part-list/><part id=\"P1\"><measure number=\"1\"/></part></score-partwise>".getBytes(StandardCharsets.UTF_8);
    @Test void recognizesXmlByContentAndPreservesBytes() {
        var result = validator.validate(new MockMultipartFile("file", "SCORE.XML", "", xml), 10000);
        assertEquals("musicxml", result.format());
        assertArrayEquals(xml, result.bytes());
        assertEquals(64, result.sha256().length());
    }
    @Test void rejectsEntityExpansionAndNonScoreXml() {
        for (String bad : new String[]{"<hello/>", "<!DOCTYPE score-partwise [<!ENTITY x SYSTEM 'file:///no-access'>]><score-partwise>&x;</score-partwise>"})
            assertThrows(RuntimeException.class, () -> validator.validate(new MockMultipartFile("file", "score.xml", "application/xml", bad.getBytes(StandardCharsets.UTF_8)), 10000));
    }
    @Test void enforcesStreamSizeAndRejectsFakePdf() {
        assertThrows(RuntimeException.class, () -> validator.validate(new MockMultipartFile("file", xml), 12));
        assertThrows(RuntimeException.class, () -> validator.validate(new MockMultipartFile("file", "%PDF-1.7 garbage".getBytes(StandardCharsets.UTF_8)), 10000));
    }
    @Test void readsMxlRootAndRejectsTraversal() throws Exception {
        byte[] archive = zip("score.musicxml", xml);
        assertEquals("mxl", validator.validate(new MockMultipartFile("file", archive), 10000).format());
        assertThrows(RuntimeException.class, () -> validator.validate(new MockMultipartFile("file", zip("../score.xml", xml)), 10000));
    }
    @Test void acceptsStandardExternalDoctypeWithoutLoadingItAndRejectsUtf16Entities() throws Exception {
        String header="<?xml version=\"1.0\"?><!DOCTYPE score-partwise PUBLIC \"-//Recordare//DTD MusicXML 4.0 Partwise//EN\" \"https://www.musicxml.org/dtds/partwise.dtd\"><score-partwise><part-list/></score-partwise>";
        assertEquals("musicxml",validator.validate(new MockMultipartFile("file",header.getBytes(StandardCharsets.UTF_8)),10000).format());
        assertEquals("mxl",validator.validate(new MockMultipartFile("file",zip("score.xml",header.getBytes(StandardCharsets.UTF_8))),10000).format());
        byte[] internal="<?xml version=\"1.0\" encoding=\"UTF-16\"?><!DOCTYPE score-partwise [<!ENTITY secret 'value'>]><score-partwise>&secret;</score-partwise>".getBytes(StandardCharsets.UTF_16);
        assertThrows(RuntimeException.class,()->validator.validate(new MockMultipartFile("file",internal),10000));
    }
    @Test void rejectsMxlWithMissingCentralDirectory() throws Exception {
        byte[] valid=zip("score.xml",xml); int cut=0;
        for(int i=0;i<valid.length-4;i++) if(valid[i]==0x50 && valid[i+1]==0x4b && valid[i+2]==1 && valid[i+3]==2) { cut=i; break; }
        byte[] truncated=java.util.Arrays.copyOf(valid,cut);
        assertThrows(RuntimeException.class,()->validator.validate(new MockMultipartFile("file",truncated),10000));
    }
    private byte[] zip(String name, byte[] contents) throws Exception {
        var out = new ByteArrayOutputStream();
        try (var zip = new ZipOutputStream(out)) { zip.putNextEntry(new ZipEntry(name)); zip.write(contents); zip.closeEntry(); }
        return out.toByteArray();
    }
}
