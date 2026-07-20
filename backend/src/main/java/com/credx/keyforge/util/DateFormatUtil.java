package com.credx.keyforge.util;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Shared date formatting used across usage log exports and analytics
 * responses. Formats in UTC as yyyy-MM-dd.
 */
public final class DateFormatUtil {

    private static final DateTimeFormatter DAY_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);

    private DateFormatUtil() {
    }

    public static String toDayString(Instant instant) {
        return DAY_FORMATTER.format(instant);
    }
}
