FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

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
