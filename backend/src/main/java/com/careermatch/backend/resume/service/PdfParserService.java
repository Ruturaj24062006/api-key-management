package com.careermatch.backend.resume.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class PdfParserService {

    private final Tika tika = new Tika();

    public String parsePdf(InputStream inputStream) throws IOException {
        // Copy stream to a temp file
        Path tempFile = Files.createTempFile("resume-", ".tmp");
        try (OutputStream out = Files.newOutputStream(tempFile)) {
            inputStream.transferTo(out);
        }

        // 1. Try Apache PDFBox directly (highly reliable in standard JRE environments)
        try {
            log.info("Attempting PDF text extraction via Apache PDFBox directly...");
            try (PDDocument document = Loader.loadPDF(tempFile.toFile())) {
                PDFTextStripper pdfStripper = new PDFTextStripper();
                String text = pdfStripper.getText(document);
                if (text != null && !text.isBlank()) {
                    log.info("Apache PDFBox PDF extraction succeeded.");
                    Files.deleteIfExists(tempFile);
                    return text;
                }
            }
        } catch (Exception e) {
            log.warn("Apache PDFBox extraction failed: {}. Falling back to Apache Tika.", e.getMessage());
        }

        // 2. Try Apache Tika (pure Java, in-process, no OS dependencies)
        try {
            log.info("Attempting PDF text extraction via Apache Tika...");
            String text = tika.parseToString(Files.newInputStream(tempFile));
            if (text != null && !text.isBlank()) {
                log.info("Apache Tika PDF extraction succeeded.");
                Files.deleteIfExists(tempFile);
                return text;
            }
        } catch (Exception e) {
            log.warn("Apache Tika extraction failed: {}. Falling back to PyMuPDF.", e.getMessage());
        }

        // 3. Fallback to PyMuPDF (fitz Python script)
        try {
            log.info("Attempting PDF text extraction via PyMuPDF (fitz) script fallback...");
            String text = runPythonParser(tempFile.toAbsolutePath().toString());
            if (text != null && !text.isBlank()) {
                log.info("PyMuPDF PDF extraction succeeded.");
                return text;
            }
        } catch (Exception e) {
            log.error("PyMuPDF fallback extraction failed: {}", e.getMessage());
        } finally {
            Files.deleteIfExists(tempFile);
        }

        throw new RuntimeException("All PDF parsers failed to extract text from resume");
    }

    private String runPythonParser(String absolutePath) throws Exception {
        Path tempScript = Files.createTempFile("pdf_parser-", ".py");
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("scripts/pdf_parser.py");
             OutputStream os = Files.newOutputStream(tempScript)) {
            if (is == null) {
                throw new FileNotFoundException("Classpath resource scripts/pdf_parser.py not found");
            }
            is.transferTo(os);
        }

        try {
            ProcessBuilder pb = new ProcessBuilder("python", tempScript.toAbsolutePath().toString(), absolutePath);
            Process process = pb.start();

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }

            // Apply a 30-second execution timeout to prevent worker thread starvation
            boolean finished = process.waitFor(30, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.error("PyMuPDF Python parsing process timed out after 30 seconds for file: {}", absolutePath);
                throw new RuntimeException("Python PDF parser script timed out after 30 seconds");
            }

            int exitCode = process.exitValue();
            if (exitCode != 0) {
                StringBuilder error = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        error.append(line).append("\n");
                    }
                }
                throw new RuntimeException("Python script exited with code " + exitCode + ". Error: " + error);
            }
            return output.toString();
        } finally {
            try {
                Files.deleteIfExists(tempScript);
            } catch (Exception ex) {
                log.warn("Failed to delete temp script file: {}", ex.getMessage());
            }
        }
    }

    private String parseWithTika(Path filePath) {
        try (InputStream is = Files.newInputStream(filePath)) {
            return tika.parseToString(is);
        } catch (Exception e) {
            log.error("Apache Tika fallback parsing failed: {}", e.getMessage());
            throw new RuntimeException("All PDF parsers failed to extract text: " + e.getMessage(), e);
        } finally {
            try {
                Files.deleteIfExists(filePath);
            } catch (Exception ex) {
                log.warn("Failed to delete temp file: {}", ex.getMessage());
            }
        }
    }
}
