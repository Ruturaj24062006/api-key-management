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
# JRE base image already includes glibc and libstdc++6 by default on Ubuntu Jammy.
# We do not install Python, pip, or PyMuPDF, keeping the image minimal and build-stable.
COPY --from=build /app/target/career-match-backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
