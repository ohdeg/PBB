package com.studiobs.spring_backend.global.r2;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class JpegResizeTest {

    @Test
    void toJpeg_capsLongEdgeAndKeepsAspect() throws Exception {
        BufferedImage src = new BufferedImage(1600, 800, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = src.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, 1600, 800);
        g.dispose();
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(src, "png", png);

        byte[] jpeg = JpegResize.toJpeg(png.toByteArray());
        BufferedImage out = ImageIO.read(new java.io.ByteArrayInputStream(jpeg));

        assertThat(out.getWidth()).isEqualTo(1280);
        assertThat(out.getHeight()).isEqualTo(640);
        assertThat(jpeg.length).isGreaterThan(0);
    }
}
