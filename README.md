# 📚 Readability.js API Docker Container


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project provides a simple API wrapped in a Docker container that leverages the powerful `Readability.js` library (from Mozilla Firefox) to extract clean, article-like content from raw HTML. It's perfect for:

- **LLM (Large Language Model) Analysis:** Get clean text for summarization, sentiment analysis, or knowledge base building.
- **Content Display:** Strip away distractions and present main article content.
- **Data Processing:** Extract key article components (title, author, content).

## ✨ Features

- **HTML to Article Extraction:** Uses `@mozilla/readability` to parse HTML and extract the main article content.
- **HTML Sanitization:** Employs `DOMPurify` to ensure the output HTML content is safe and free from malicious scripts (XSS).
- **Flexible Text Output:** Get either the full structured JSON output or a clean, paragraph-separated plain text output (ideal for LLMs).
- **Token-Based Authentication:** Protect your API with a simple secret token.
- **Containerized:** Easy to deploy anywhere Docker runs, including platforms like Coolify or DockPloy.
- **Multi-Architecture Image:** The official image (`ghcr.io/imad07mos/readabilityjs-api:latest`) is built to work on both `linux/amd64` (Intel/AMD) and `linux/arm64` (ARM, e.g., M1/M2 Mac, AWS Graviton) hosts, ensuring broad compatibility.

## 🚀 Quick Start (Local Development)

This section guides you through getting the API up and running on your local machine for testing.

### Prerequisites

Before you begin, ensure you have:
- **Docker Desktop:** (Recommended) Installed and running on your machine.
- **`curl`:** A command-line tool for making HTTP requests (usually pre-installed on Linux/macOS, available for Windows).

### 1. Get the Code

Clone this repository to your local machine:

```bash
git clone https://github.com/imad07mos/readabilityjs-api.git
cd readabilityjs-api
```

### 2. Set Up Your Secret Token (`.env` file)

For local development, it's best practice to keep your secret token in a `.env` file. Docker Compose automatically loads variables from this file.

- In the root of your `readabilityjs-api` directory (where `docker-compose.yml` is), create a new file named `.env`.
- Add the following line to the `.env` file. **Choose a strong, unique string for your token!**

```dotenv
SECRET_TOKEN="your_super_secret_local_dev_token_123"
```

**Important:** Always add `.env` to your `.gitignore` file to prevent accidentally committing your secrets to version control!

### 3. Run with Docker Compose

Now, start the API using Docker Compose. This command will build the Docker image (if you have local code changes) or pull it from a registry, and then run your API service.

```bash
docker-compose up --build -d
```

- `--build`: Ensures any local changes to your `app.js` or `Dockerfile` are included in the image.
- `-d`: Runs the containers in "detached" mode (in the background).

### 4. Verify It's Running

You can check if the API container is up and healthy:

```bash
docker ps
```

You should see a container named `readabilityjs-api-readability-api-1` (or similar) with status `Up`.

You can also check the health endpoint:

```bash
curl http://localhost:3000/health
```

**Expected Output:** `OK`

### 5. Test Locally

Now, let's send a sample HTML request to your running API. Remember to replace `your_super_secret_local_dev_token_123` with the token you set in your `.env` file.

```bash
curl -X POST "http://localhost:3000/readability?token=your_super_secret_local_dev_token_123" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><head><title>My Awesome Article</title></head><body><h1>Main Title</h1><p>This is some content.</p><h2>Another Heading</h2><p>More paragraphs here, trying to make it somewhat interesting.</p><script>alert(\"evil script!\")</script></body></html>",
    "url": "http://example.com/blog/sample-article"
  }'
```

**Expected Output (JSON):** You should receive a JSON response containing the extracted article details, including `content` (sanitized HTML, with the script tag removed!), and `improvedTextContent` (the clean, LLM-friendly text).

## 🔑 Key Concepts Explained

Let's understand the important parameters that control this API: the `token` for security and the `strip` parameter for output format.

### The `token` Parameter (Authentication)

- **What it is:** The `token` is a security measure, acting like a secret password that grants you permission to use the API.
- **How to use it:** You must include your `token` in the URL of your API requests as a query parameter (e.g., `?token=YOUR_SECRET_TOKEN`). The API will check if this token matches the one it expects.
- **Why it's important:**
  - **Security:** Protects your API from unauthorized access and misuse.
  - **Resource Control:** Helps prevent unintended or malicious actors from consuming your server's resources.
- **Error Responses:**
  - If you don't provide a `token`: You'll receive a `401 Unauthorized` error.
  - If you provide a `token` that doesn't match: You'll receive a `403 Forbidden` error.
- **Best Practice:** Always use a very long, random, and cryptographically strong token, especially in production environments.

### The `strip` Parameter (Output Control)

- **What it is:** The `strip` parameter is an optional setting you can add to your request URL (e.g., `?token=YOUR_SECRET&strip=true`). It controls the format of the API's response.
- **How to use it:**
  - Append `&strip=true` to your URL: The API will return **only the clean, plain text** of the extracted article content. This text is specifically formatted with newlines for paragraphs and headings, making it ideal for direct input into LLMs. The `Content-Type` of the response will be `text/plain`.
  - If you omit `&strip=true` (or use `&strip=false`): The API will return a **full JSON object**. This JSON includes the article's `title`, `excerpt`, the sanitized HTML `content`, the original `rawTextContent` (from Readability, often concatenated), and the improved, LLM-friendly text in `improvedTextContent`. The `Content-Type` will be `application/json`.
- **Why it's useful for LLMs:** Large Language Models generally prefer clean, structured plain text without HTML tags. The `strip=true` option provides this exact format, simplifying your LLM input pipeline.

**Example `curl` for plain text output:**

```bash
curl -X POST "http://localhost:3000/readability?token=your_super_secret_local_dev_token_123&strip=true" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><head><title>My Awesome Article</title></head><body><h1>Main Title</h1><p>This is some content.</p><h2>Another Heading</h2><p>More paragraphs here, trying to make it somewhat interesting.</p></body></html>",
    "url": "http://example.com/blog/sample-article"
  }'
```

**Expected Plain Text Output:**

```text
Main Title

This is some content.

Another Heading

More paragraphs here, trying to make it somewhat interesting.
```

## 🐳 Deployment to Coolify / DockPloy

This section details how to deploy your API using self-hosting platforms that leverage Docker Compose, such as Coolify or DockPloy.

Your Docker image is already built for multiple architectures (`linux/amd64` and `linux/arm64`) and available on GitHub Container Registry.

### Docker Compose Configuration for Deployment

Here's the `docker-compose.yml` content you will use on your deployment platform:

```yaml
version: '3.8'

services:
  readability-api:
    # This specifies the Docker image to pull from GitHub Container Registry.
    # It's multi-architecture, so Coolify will automatically pick the right version for its server.
    image: ghcr.io/imad07mos/readabilityjs-api:latest

    # The internal port your Node.js application listens on (port 3000).
    # Coolify will map this to an external port and set up routing/SSL automatically.
    ports:
      - "3000"

    # Environment variables passed to your container.
    # IMPORTANT: The SECRET_TOKEN must be set securely in Coolify/DockPloy's UI!
    environment:
      SECRET_TOKEN: ${SECRET_TOKEN} # This tells Docker Compose to get the value from the environment.
      PORT: 3000

    # Ensures your container restarts automatically if it crashes or the Docker daemon restarts.
    restart: unless-stopped
```

### Managing `SECRET_TOKEN` in Coolify / DockPloy (Crucial Security)

**It is critical not to hardcode your actual `SECRET_TOKEN` value directly into the `docker-compose.yml` file if you commit this file to a public Git repository!**

Instead, you should manage this secret securely within your deployment platform's UI:

1. **Go to your Coolify (or DockPloy) instance.**
2. **Create a New Application/Service.**
3. **Choose the "Docker Compose" deployment method.**
4. **Paste the `docker-compose.yml` content** provided above into the configuration area.
5. **Find the "Environment Variables" or "Secrets" section** within your application's settings in the Coolify/DockPloy UI.
6. **Add a new environment variable:**
   - **Name:** `SECRET_TOKEN`
   - **Value:** **Paste your strong, unique production secret token here.**
7. **Complete any remaining deployment steps** (e.g., adding a custom domain for easy access).

Coolify/DockPloy will securely inject this `SECRET_TOKEN` into your running container's environment, keeping it safe from being exposed in your source code.

## 🛠️ Advanced Usage (Optional)

### Building Your Own Multi-Architecture Image

If you modify the source code (e.g., `app.js`) or want to update Node.js dependencies (`package.json`) to get the very latest versions, you'll need to rebuild your own Docker image and push it to your own registry.

1. **Ensure `docker buildx` is set up:**
   ```bash
   docker buildx create --name mybuilder --use # (Run this once if you haven't already)
   ```

2. **Log in to your Docker registry:**
   ```bash
   docker login ghcr.io # Or `docker login` for Docker Hub
   ```

3. **Build and push the multi-architecture image:**
   Navigate to your project's root directory (`readabilityjs-api`) and run the following single command:
   ```bash
   docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/yourusername/readabilityjs-api:latest . --push
   ```
   **Remember to replace `yourusername` with your Docker Hub or GitHub username!**

### Customizing Readability & DOMPurify Options

You can pass configuration options for `Readability.js` and `DOMPurify` within your JSON request body. The API includes internal filtering to ensure only safe and expected options are processed.

**Example `curl` with options:**

```bash
curl -X POST "http://localhost:3000/readability?token=your_super_secret_local_dev_token_123" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<p class=\"important\">A short article with an <script>alert(\"XSS\")</script> evil script and an important class.</p>",
    "url": "http://example.com/custom-options",
    "readabilityOptions": {
      "charThreshold": 1000,
      "debug": true,
      "classesToPreserve": ["important"]
    },
    "domPurifyOptions": {
      "FORBID_TAGS": ["p"],
      "USE_PROFILES": { "html": true }
    }
  }'
```

## 🧹 Cleanup (Local Development)

To stop and remove your locally running API containers and the associated network:

```bash
docker-compose down
```

## License

This project was built with the aid of Gemini 2.5 Flash Preview 05-20, licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
