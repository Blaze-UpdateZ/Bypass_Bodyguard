# 🛡️ Bypass-Bodyguard

A powerful, high-performance Node.js API designed to secure, manage, and track bypass link interactions. Built with Express and MongoDB, and optimized for serverless deployments like Vercel.

---

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
- [API Usage](#-api-usage)
- [Deployment](#-deployment)
  - [Vercel](#vercel)
- [Configuration](#-configuration)
- [Credits](#-credits)
- [License](#-license)

---

## ✨ Features

- **Link Shortener Logic**: Advanced route handling and redirection services.
- **Robust Security**: Rate limiting, CORS configuration, and body-parser integrations.
- **Bot Physics**: Custom rendering and physics utilities for dynamic link interactions.
- **Database Integration**: MongoDB caching and metric tracking using Mongoose.
- **Serverless Ready**: Fully configured `.vercel` routing and trust proxies for instant edge deployment.

## 🚀 Quick Start

### Installation

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/Blaze-UpdateZ/bypass-bodyguard.git
    cd bypass-bodyguard
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    ```

3.  **Configure environment variables**:
    Create a `.env` file based on your security needs:
    ```bash
    PORT=3000
    MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/bypass_guard"
    ```

### Running Locally

```bash
npm start
```

The server will be available at `http://localhost:3000`.

## 🛠 API Usage

The application provides backend endpoints for link generation. All generation requests are rate-limited.

### 1. Generate Standard Link

**Endpoint**: `POST /api/generate`

**Payload**:

```json
{
  "targetUrl": "https://example.com/destination",
  "wait": 10
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "mainLink": "https://yourdomain.com/?s=xyz123",
    "shortenedLink": "https://adrinolinks.in/...",
    "targetUrl": "https://example.com/destination"
  }
}
```

### 2. Generate Dynamic Link (Custom Shortener)

**Endpoint**: `POST /api/getlink` (Also accepts `GET`)

**Payload / Query Parameters**:

```json
{
  "url": "https://example.com/destination",
  "api": "your_dynamic_api_token",
  "site": "custom-shortener.com",
  "wait": 15
}
```

## 🌐 Deployment

### Vercel

This project is configured for seamless deployment on Vercel:

1.  Push your code to GitHub.
2.  Import the project into Vercel.
3.  Add `MONGO_URI` to the environment variables in your Vercel project settings.
4.  Deploy! The `vercel.json` ensures that `server.js` functions as the serverless entry point.

## 📝 Configuration

Ensure the following variables are set in your environment:

| Variable    | Description                                |
| :---------- | :----------------------------------------- |
| `MONGO_URI` | Connection string for your MongoDB cluster |
| `PORT`      | Local server port (default: 3000)          |
| `NODE_ENV`  | Useful for disabling listeners on Vercel   |

## 🤝 Credits

- **Powered by**: [@Blaze_Updatez](https://t.me/Blaze_Updatez)
- **Created by**: [@Bharath_boy](https://t.me/Bharath_boy)

## ⚖️ License

MIT License. See [LICENSE](LICENSE) for more details.

---

_Disclaimer: This project is for personal use and educational purposes. Use responsibly._

