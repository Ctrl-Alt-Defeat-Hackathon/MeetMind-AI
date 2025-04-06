# MeetSmart: AI-Powered Meeting Companion

![MeetSmart Logo](frontend/public/meetsmartlogo.png)

## 🏆 LuddyHacks Project - AI-Powered Meeting Assistant

MeetSmart is an intelligent meeting companion that transcribes, analyzes, and extracts actionable insights from your meetings. Whether you're uploading recorded meetings or connecting to live conversations, our AI-powered solution helps teams quickly understand what was discussed, what actions are needed, and the overall tone of the discussion.

## ✨ Features

- **Smart Transcription**: Convert speech to text with speaker identification
- **Intelligent Summaries**: Generate concise meeting summaries and key points
- **Action Item Extraction**: Automatically identify tasks, owners, and deadlines
- **Tone Analysis**: Understand the emotional context of conversations
- **Multilingual Support**: Translate meeting content into 10 different languages
- **Integration Capabilities**: Export to PDF or create Jira tasks
- **Media Flexibility**: Support for uploaded audio/video files and YouTube URLs

## 🚀 Getting Started

### Prerequisites

- Node.js (v14.0 or higher)
- Python (v3.8 or higher)
- pip (Python package manager)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/meetSmart.git
   cd meetSmart
   ```

2. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```

3. Install backend dependencies:
   ```
   cd ../backend
   pip install -r requirements.txt
   ```

### Running the Application

1. Start the backend server:
   ```
   cd backend
   python app_main.py
   ```

2. In a new terminal, start the frontend development server:
   ```
   cd frontend
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`

## 🛠️ Tech Stack

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- Lucide React for icons

### Backend
- FastAPI (Python web framework)
- OpenAI Whisper for speech recognition
- GPT for natural language processing

## 📊 Use Cases

MeetSmart is ideal for:

- **Business Meetings**: Capture discussions, decisions, and action items
- **Client Calls**: Record important details and commitments
- **Interviews**: Analyze responses and extract key insights
- **Lectures and Webinars**: Create summaries and translations
- **Team Standups**: Track progress and assignments

## 👥 Team

- [Athish ] - Frontend Developer
- [Aathirai] - Backend Developer
- [Shruthi] - Backend Developer
- [Jithendriya] - UX/UI Designer

## 🔮 Future Enhancements

- Real-time meeting transcription and analysis
- Integration with video conferencing platforms
- Custom vocabulary training for industry-specific terminology
- Advanced analytics dashboard for meeting trends
- Calendar integration for automatic meeting scheduling

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Luddy School of Informatics, Computing, and Engineering for hosting LuddyHacks
- OpenAI for providing the models that power our intelligent features
- All the mentors and judges who provided guidance during the hackathon 