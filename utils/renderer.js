/**
 * Central UI Renderer for Backend Responses
 * Ensures all non-game pages (Errors, Blocks) match the Red Neon theme.
 */

const themedError = (title, message, status = 403) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="stylesheet" href="/shared.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Outfit:wght@700;800&display=swap');
        
        .error-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            text-align: center;
            padding: 20px;
            background: radial-gradient(circle at center, #1a1a3e 0%, #0c0c1e 100%);
        }
        .error-card {
            background: rgba(0, 0, 0, 0.85);
            padding: 40px;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.5);
            max-width: 500px;
            width: 100%;
            backdrop-filter: blur(15px);
        }
        h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 2.2rem;
            margin-bottom: 15px;
            background: linear-gradient(135deg, var(--primary-neon), var(--secondary-neon));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        p {
            font-family: 'Inter', sans-serif;
            color: #c0c0fb;
            font-size: 1.05rem;
            line-height: 1.6;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-card">
            <h2>${title}</h2>
            <p>${message}</p>
        </div>
    </div>
</body>
</html>
`;

module.exports = { themedError };
