FROM node:14-alpine
WORKDIR /opt/testdata-generator
RUN mkdir input
COPY package.json package.json

COPY src ./src
RUN npm install
RUN mkdir output

RUN apk --no-cache add curl=7.67.0-r3

RUN curl -LO https://github.com/samply/blazectl/releases/download/v0.3.0/blazectl-0.3.0-linux-amd64.tar.gz \
&& tar xzf blazectl-0.3.0-linux-amd64.tar.gz \
&& mv ./blazectl /usr/local/bin/blazectl \
&& blazectl --version

COPY docker-entrypoint.sh .
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
LABEL org.opencontainers.image.source="https://gitlab.miracum.org/miracum/fhir/fhir-testdata-generator"