package com.studiobs.spring_backend.global.r2;

import com.studiobs.spring_backend.global.exception.BusinessException;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Iterator;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import org.springframework.http.HttpStatus;

public final class JpegResize {

    public static final int MAX_EDGE = 1280;
    public static final float QUALITY = 0.85f;
    public static final long MAX_UPLOAD_BYTES = 8L * 1024 * 1024;

    private JpegResize() {
    }

    public static byte[] toJpeg(byte[] input) {
        if (input == null || input.length == 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지 파일이 비어 있습니다.");
        }
        BufferedImage src;
        try {
            src = ImageIO.read(new ByteArrayInputStream(input));
        } catch (Exception ex) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지를 읽을 수 없습니다.");
        }
        if (src == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지를 읽을 수 없습니다.");
        }
        int width = src.getWidth();
        int height = src.getHeight();
        double scale = Math.min(1.0, (double) MAX_EDGE / Math.max(width, height));
        int nextWidth = Math.max(1, (int) Math.round(width * scale));
        int nextHeight = Math.max(1, (int) Math.round(height * scale));
        BufferedImage rgb = new BufferedImage(nextWidth, nextHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = rgb.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, nextWidth, nextHeight);
            graphics.setRenderingHint(
                    RenderingHints.KEY_INTERPOLATION,
                    RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.drawImage(src, 0, 0, nextWidth, nextHeight, null);
        } finally {
            graphics.dispose();
        }
        return encodeJpeg(rgb);
    }

    private static byte[] encodeJpeg(BufferedImage rgb) {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");
        if (!writers.hasNext()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "이미지를 인코딩할 수 없습니다.");
        }
        ImageWriter writer = writers.next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        if (param.canWriteCompressed()) {
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(QUALITY);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(rgb, null, null), param);
        } catch (Exception ex) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "이미지를 인코딩할 수 없습니다.");
        } finally {
            writer.dispose();
        }
        byte[] bytes = out.toByteArray();
        if (bytes.length == 0) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "이미지를 인코딩할 수 없습니다.");
        }
        if (bytes.length > MAX_UPLOAD_BYTES) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지는 8MB 이하여야 합니다.");
        }
        return bytes;
    }
}
