FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw mvnw
COPY pom.xml pom.xml
COPY src src
# Fix CRLF carriage return line endings in mvnw script for Linux compatibility
RUN tr -d '\r' < mvnw > mvnw.tmp && mv mvnw.tmp mvnw && chmod +x mvnw && ./mvnw clean package -DskipTests

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
# Install libstdc++6 (required by ONNX runtime), python3, and pip
RUN apt-get update && apt-get install -y --no-install-recommends \
    libstdc++6 \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install PyMuPDF for resume processing
RUN pip3 install --no-cache-dir pymupdf --break-system-packages

COPY --from=build /app/target/career-match-backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
