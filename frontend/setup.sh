#!/bin/bash

# GitHub Memory System Demo Setup Script
echo "🧠 Setting up GitHub Memory System Demo..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required."
    echo "Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create public directory if it doesn't exist
mkdir -p public

# Create a simple favicon
echo "🎨 Creating favicon..."
cat > public/favicon.ico << 'EOF'
<!-- Placeholder favicon -->
EOF

# Create manifest.json
echo "📱 Creating manifest.json..."
cat > public/manifest.json << 'EOF'
{
  "short_name": "GitHub Memory",
  "name": "GitHub Memory System Demo",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#0ea5e9",
  "background_color": "#ffffff"
}
EOF

echo "🚀 Setup complete!"
echo ""
echo "To start the demo:"
echo "  npm start"
echo ""
echo "To build for production:"
echo "  npm run build"
echo ""
echo "The demo will be available at http://localhost:8745"
echo ""
echo "Features included:"
echo "  🔍 Semantic Search with OpenAI-style results"
echo "  💾 Pattern Storage with GitHub integration"
echo "  📊 Analytics dashboard with interactive charts"
echo "  🔗 GitHub Integration management"
echo "  ⏰ Memory Timeline with activity history"
echo ""
echo "Enjoy exploring the GitHub Memory System! 🎉"