# 🎬 Plex Dual Subtitle Manager

A powerful web application for creating and managing dual-language subtitles for your Plex media library. Combines two subtitle files into a single file with advanced positioning, styling, and automatic synchronization.

![Language Support](https://img.shields.io/badge/Languages-English%20%7C%20Chinese%20%7C%20Japanese%20%7C%20Korean-blue)
![Format Support](https://img.shields.io/badge/Formats-ASS%20%7C%20SRT-green)
![Sync](https://img.shields.io/badge/Sync-ffsubsync-orange)

## ✨ Features

### 🎯 Core Functionality
- **Dual Subtitle Creation**: Merge two subtitle files with custom positioning (top/bottom)
- **Format Support**: ASS (advanced styling) and SRT (simple text) output formats
- **Automatic Language Detection**: Intelligent detection of Chinese (Traditional/Simplified), Japanese, and English
- **Subtitle Synchronization**: Uses ffsubsync to automatically align subtitle timing

### 🎨 Advanced Styling (ASS Format)
- **Custom Colors**: Choose any color for primary and secondary subtitles
- **Font Sizing**: Adjustable font sizes with CJK language optimization
- **Perfect Positioning**: Separate top/bottom positioning with proper margins
- **Language-Optimized Fonts**: Automatic font selection for better CJK character display

### 🔧 Technical Features
- **Plex Integration**: Direct integration with your Plex Media Server
- **Embedded Subtitle Extraction**: Extract subtitles from video files
- **Encoding Detection**: Automatic character encoding detection and conversion
- **Video Sync Validation**: Verify subtitle timing matches video duration
- **Batch Operations**: Process multiple files efficiently

### 🌍 Language Support
- **Chinese**: Traditional (zh-TW) and Simplified (zh-CN) with character set analysis
- **Japanese**: Hiragana, Katakana, and Kanji detection
- **English**: Full ASCII and extended character support
- **Korean**: Basic support for Hangul characters

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+**
- **Node.js 16+** 
- **Plex Media Server** with accessible media libraries
- **ffmpeg** (recommended, for subtitle synchronization)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/PlexDualSub.git
   cd PlexDualSub
   ```

2. **Set up the environment**
   ```bash
   # Install Python dependencies
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Install Node.js dependencies  
   cd frontend
   npm install
   cd ..
   ```

3. **Configure Plex connection**
   ```bash
   cp .env.example .env
   # Edit .env with your Plex server details
   ```

4. **Start the application**
   ```bash
   python run.py
   ```

5. **Open your browser**
   ```
   http://localhost:5173
   ```

### Configuration

After installation, configure your Plex connection by editing the `.env` file:

```bash
# Your Plex server URL (local or remote)
PLEX_URL=http://localhost:32400

# Your Plex authentication token
# Get this from: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
PLEX_TOKEN=your_plex_token_here

# Your Plex server name (optional)
PLEX_SERVER_NAME=My Plex Server

# The name of your TV shows library in Plex
PLEX_TV_LIBRARY=TV Shows
```

### Alternative: Manual Start

To start services individually:

1. **Backend** (Terminal 1)
   ```bash
   source venv/bin/activate
   cd backend
   python main.py
   ```

2. **Frontend** (Terminal 2)
   ```bash
   cd frontend
   npm run dev
   ```

## 📖 Usage Guide

### 1. **Browse Your Library**
- Navigate to "TV Shows" to see your Plex library
- Click on any show to view episodes and subtitle status

### 2. **Create Dual Subtitles**
- Select an episode with multiple subtitle files
- Choose primary and secondary subtitle files
- Select output format (ASS recommended for styling)
- Customize colors, fonts, and positioning
- Enable/disable automatic synchronization
- Preview and create your dual subtitle

### 3. **File Naming Convention**
Dual subtitle files are automatically named using detected languages:
```
Show Name - S01E01.zh-tw.en.dual.ass
Show Name - S01E01.ja.en.dual.ass
Show Name - S01E01.cn.en.dual.ass
```

## 🎛️ Configuration Options

### ASS Format Features
- **Primary/Secondary Positioning**: Top or bottom placement
- **Custom Colors**: Hex color picker for both subtitle tracks
- **Font Sizing**: 12-48px with language-specific optimization
- **Automatic Styling**: Proper outline, shadow, and CJK font selection

### Synchronization Options
- **Auto-sync**: Uses ffsubsync to align secondary to primary timing
- **Manual Control**: Disable sync for files that are already aligned
- **Fallback**: Gracefully falls back to original timing if sync fails

## 🛠️ Technical Details

### Architecture
- **Backend**: FastAPI with Python
- **Frontend**: React with TypeScript and TailwindCSS
- **Subtitle Processing**: pysubs2 library
- **Synchronization**: ffsubsync integration
- **Language Detection**: Custom CJK-optimized algorithm

### File Formats
- **Input**: SRT, ASS, SSA, VTT, SUB
- **Output**: ASS (recommended), SRT
- **Encoding**: Automatic detection with UTF-8 conversion

### API Endpoints
- `GET /api/shows` - List TV shows
- `GET /api/episodes/{id}/subtitles` - Get episode subtitles
- `POST /api/episodes/{id}/subtitles/dual` - Create dual subtitle
- `POST /api/subtitles/dual/preview` - Preview subtitle combination

## 🔧 Optional Dependencies

### ffmpeg (Recommended)
For subtitle synchronization support:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/
```

### OpenCC (Optional)
For Chinese Traditional/Simplified conversion:
```bash
pip install opencc-python-reimplemented
```

## 📁 Project Structure

```
PlexDualSub/
├── backend/                    # FastAPI backend
│   ├── services/              # Business logic services
│   │   ├── plex_service.py   # Plex API integration
│   │   ├── subtitle_service.py # Subtitle processing
│   │   └── ...               # Other services
│   ├── main.py               # API server (current)
│   ├── main_refactored.py    # Enhanced API server
│   └── config.py             # Configuration management
├── frontend/                  # React frontend
│   ├── src/                  # React components
│   │   ├── pages/           # Main application pages
│   │   ├── components/      # Reusable components
│   │   └── lib/            # API client and utilities
│   └── package.json         # Node.js dependencies
├── requirements.txt          # Python dependencies
├── run.py                   # Main launcher script
├── cleanup.py               # Port cleanup utility
├── .env.example             # Environment template
└── .gitignore              # Git ignore rules
```

## 🐛 Troubleshooting

### Common Issues

**Plex Connection Failed**
- Verify Plex server is running and accessible
- Check network connectivity to Plex server

**Synchronization Not Working**
- Install ffmpeg: `brew install ffmpeg`
- Ensure subtitle files are compatible

**Language Detection Issues**
- Large subtitle files work better for detection
- Manual language selection available as fallback

**Frontend Not Loading**
- Check if both servers are running
- Verify ports 5173 (frontend) and 8000 (backend) are available
- Use `python cleanup.py` to free up conflicting ports

## 📝 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## ⭐ Acknowledgments

- **ffsubsync** - Automatic subtitle synchronization
- **pysubs2** - Subtitle file processing
- **Plex** - Media server integration
- **React** - Frontend framework
- **FastAPI** - Backend framework