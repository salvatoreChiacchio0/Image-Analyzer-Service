# Image Analyzer

## Overview
Image Analyzer is a distributed application designed for efficient image processing and analysis. Built with a microservices architecture, it leverages modern technologies to provide scalable and robust image analysis capabilities. The system processes images through a pipeline of services, enabling real-time analysis, storage, and relationship mapping of image data.

## System Architecture

### Core Components

#### 1. Message Broker (Kafka)
- **Purpose**: Handles asynchronous communication between services
- **Configuration**:
  - Broker ID: 1
  - Internal Port: 9092
  - External Port: 29092
  - Replication Factor: 1
  - Auto Topic Creation: Enabled
- **Health Checks**: Implemented with 30s intervals

#### 2. Data Storage
- **MongoDB**
  - Purpose: Primary data store for image metadata and analysis results
  - Connection: mongodb://host.docker.internal:27017
  - Usage: Stores image metadata, analysis results, and processing status

- **Neo4j**
  - Purpose: Graph database for relationship analysis
  - Connection: bolt://host.docker.internal:7689
  - Usage: Stores and analyzes relationships between images and detected objects

#### 3. Image Analysis
- **Google Cloud Vision API**
  - Purpose: Core image analysis engine
  - Integration: Via service account credentials
  - Capabilities: Object detection, label detection, face detection, OCR

#### 4. Containerization
- **Docker & Docker Compose**
  - Purpose: Service isolation and deployment
  - Version: 3.8
  - Network: Internal Docker network for service communication

## Technical Requirements

### System Requirements
- Docker Engine (version 20.10.0 or higher)
- Docker Compose (version 2.0.0 or higher)
- Minimum 4GB RAM
- 10GB free disk space

### External Dependencies
- MongoDB (running on port 27017)
- Neo4j (running on port 7689)
- Google Cloud Platform account with Vision API enabled

## Installation & Setup

### 1. Prerequisites
```bash
# Verify Docker installation
docker --version
docker-compose --version

# Ensure MongoDB is running
mongod --version

# Verify Neo4j installation
neo4j --version
```

### 2. Configuration Steps
1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd image-analyzer
   ```

2. Set up Google Cloud credentials:
   - Create a service account in Google Cloud Console
   - Download the service account key as `service-account.json`
   - Place the file in the project root directory

3. Configure environment variables:
   - Create a `.env` file based on the provided template
   - Update the configuration values as needed

### 3. Starting the Application
```bash
# Build and start all services
docker-compose up --build

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f
```

## Service Configuration

### Kafka Configuration
```yaml
KAFKA_BROKER_ID: 1
KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092
KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

### Image Analyzer Service Configuration
```yaml
KAFKA_BROKERS: kafka:9092
MONGODB_URI: mongodb://host.docker.internal:27017
NEO4J_URI: bolt://host.docker.internal:7689
NEO4J_USERNAME: neo4j
NEO4J_PASSWORD: [configured]
GOOGLE_APPLICATION_CREDENTIALS: /app/service-account.json
```

## Project Structure
```
.
├── docker-compose.yml          # Docker services configuration
├── service-account.json       # Google Cloud credentials
├── src/                       # Source code directory
│   ├── main/                 # Main application code
│   └── test/                 # Test files
├── config/                    # Configuration files
└── docs/                      # Documentation
```

## Security Considerations

### Credential Management
- Google Cloud credentials are mounted as a volume
- Sensitive data should be managed through environment variables
- Production deployments should use a secrets management system

### Network Security
- Internal service communication occurs within Docker network
- External access is limited to necessary ports
- All sensitive data transmission is encrypted

## Development

### Setting Up Development Environment
1. Install development dependencies
2. Configure IDE settings
3. Set up pre-commit hooks

### Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style
- Follow the project's coding standards
- Include unit tests for new features
- Update documentation for significant changes

## Monitoring and Maintenance

### Health Checks
- Kafka health check implemented
- Service status monitoring
- Resource usage tracking

### Logging
- Centralized logging system
- Log rotation and retention policies
- Error tracking and alerting

## Troubleshooting

### Common Issues
1. Service connection failures
2. Credential authentication errors
3. Resource allocation problems

### Debugging
- Check service logs
- Verify network connectivity
- Validate configuration settings

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support
For support, please open an issue in the GitHub repository or contact the maintainers. 