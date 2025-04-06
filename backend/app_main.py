import os
from openai import OpenAI
import openai
from pydantic import BaseModel, validator, ValidationError
import re
import os
import json
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
import os
import tempfile
from io import BytesIO
import configparser
from fpdf import FPDF
from fastapi.responses import FileResponse



# Read config file from parent directory
config = configparser.ConfigParser()
config_path = os.path.join(os.path.dirname(__file__), '..', 'secret.config')
config.read(config_path)

# Get secrets
try:
    OPENAI_API_KEY = config["secrets"]["OPENAI_API_KEY"]
    HUBSPOT_ACCESS_TOKEN = config["secrets"]["HUBSPOT_ACCESS_TOKEN"]
except KeyError as e:
    raise HTTPException(status_code=500, detail=f"Missing config key: {e}")

# Initialize OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)
SUPPORTED_FILE_FORMATS = {".mp3", ".mp4", ".wav"}

# Initialize LLM (ChatGPT for extracting deal info and tone analysis)
llm = ChatOpenAI(model_name="gpt-4", temperature=0, openai_api_key=OPENAI_API_KEY)

# FastAPI app initialization
app = FastAPI()

# Add CORS middleware to allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Language name map (used for natural language in GPT prompt)
lang_map = {
    "en": "English", "es": "Spanish", "fr": "French", "hi": "Hindi", "de": "German",
    "zh": "Chinese", "ta": "Tamil", "te": "Telugu", "ja": "Japanese"
}

# TRANSCRIPT_PATH = os.path.join("transcripts", "data.text")
TRANSCRIPT_PATH = os.path.join("data.text")
# TRANSCRIPT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'transcripts', 'data.txt'))

class TranslationInput(BaseModel):
    language: str

class ActionItemsInput(BaseModel):
    transcript: str = ""
    tone: str = "neutral"

class QuestionInput(BaseModel):
    question: str

class TranscriptInput(BaseModel):
    transcript_text: str
    filename: str = "meeting_minutes.pdf"



@app.post("/transcribe-audio/")
async def transcribe_audio(file: UploadFile = File(...), language_code: str = "en"):
    ext = os.path.splitext(file.filename)[-1].lower()

    if ext not in SUPPORTED_FILE_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: {ext}. Supported formats: {', '.join(SUPPORTED_FILE_FORMATS)}"
        )

    print(f"📁 Uploaded file: {file.filename}")
    print(f"🔍 File extension: {ext}")

    try:
        # Save the uploaded file to a temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Call Whisper API using file path
        with open(tmp_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language_code if language_code != "en" else None
            )

        print("transcription", transcription.text.strip())
        return {"transcript": transcription.text.strip()}

    except Exception as e:
        return {"error": f"Error during transcription: {str(e)}"}

    finally:
        # Clean up the temporary file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)





@app.post("/translate-text/")
async def translate_transcript(input_data: TranslationInput):
    # Step 1: Read the transcript from the file
    if not os.path.exists(TRANSCRIPT_PATH):
        raise HTTPException(status_code=404, detail="Transcript file not found.")

    try:
        with open(TRANSCRIPT_PATH, "r", encoding="utf-8") as f:
            transcript_text = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading transcript file: {str(e)}")

    # Step 2: Prepare prompt and translate
    prompt = f"Translate the following text to {input_data.language}:\n\n{transcript_text}"
    
    try:
        translation = llm.predict(prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation error: {str(e)}")

    # Step 3: Return translated text
    return {"translated_text": translation.strip()}





@app.post("/analyze-tone/")
async def analyze_tone():
    tone_emoji_mapping = {
        "confident": "💪",
        "enthusiastic": "😃",
        "neutral": "😐",
        "uncertain": "🤔",
        "frustrated": "😤",
        "persuasive": "🗣️",
        "empathetic": "💖"
    }

    if not os.path.exists(TRANSCRIPT_PATH):
        raise HTTPException(status_code=404, detail="Transcript file not found.")

    try:
        with open(TRANSCRIPT_PATH, "r", encoding="utf-8") as f:
            transcript_text = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading transcript file: {str(e)}")

    prompt = f"""
    You are an expert in sales communication analysis.

    Analyze the following sales meeting transcript to:
    1. Identify the speaker's overall tone (from the list below).

    Use one of the following tone labels:
    ["confident", "enthusiastic", "neutral", "uncertain", "frustrated", "persuasive", "empathetic"]

    Format your response as:
    {{
        "tone": "tone label here"
    }}

    Transcript:
    {transcript_text}
    """

    # Predict using the LLM
    response_str = llm.predict(prompt).strip()
    print("Raw LLM response:", response_str)

    # Parse the JSON response
    try:
        result = json.loads(response_str)
        tone = result.get("tone", "").lower().strip()
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"LLM returned invalid JSON: {e}")

    # Map tone to emoji
    tone_emoji = tone_emoji_mapping.get(tone, "❓")  # fallback if tone is unrecognized

    return {
        "tone": tone,
        "tone_emoji": tone_emoji
    }





@app.post("/action-items/")
async def generate_action_items(input_data: ActionItemsInput):
    try:
        # Extract transcript and tone from request body
        transcript_text = input_data.transcript
        tone = input_data.tone
        
        # If no transcript provided, try to read from file
        if not transcript_text:
            if not os.path.exists(TRANSCRIPT_PATH):
                raise HTTPException(status_code=404, detail="Transcript file not found.")

            try:
                with open(TRANSCRIPT_PATH, "r", encoding="utf-8") as f:
                    transcript_text = f.read()
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error reading transcript file: {str(e)}")


        prompt = f"""
        Analyze the following sales call transcript and tone:
        1. Based on the transcript, suggest specific actions to take.
        2. The tone of the speaker is {tone}. Use this tone to suggest actions.
        Actions should be focused on moving the conversation forward and addressing any concerns or key topics raised.
        
        Format your response as:
        {{
            "actions": ["action 1", "action 2", ...]
        }}

        Transcript:
        {transcript_text}
        """
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a sales assistant. Your task is to analyze transcripts of sales calls and suggest actions based on the conversation and speaker's tone."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="gpt-4o-mini",
            max_tokens=150
        )

        # Get the response as text
        action_text = chat_completion.choices[0].message.content.strip()
        
        # Try to parse it as JSON
        try:
            action_data = json.loads(action_text)
            return action_data
        except json.JSONDecodeError:
            # If not valid JSON, create a basic actions array with the response
            # This is a fallback in case GPT doesn't return properly formatted JSON
            if "actions" not in action_text.lower():
                return {"actions": [action_text]}
            else:
                # Try to extract actions from unformatted text
                actions = []
                for line in action_text.split('\n'):
                    line = line.strip()
                    if line and not line.startswith('{') and not line.startswith('}'):
                        if ':' in line:
                            line = line.split(':', 1)[1].strip()
                        if line.startswith('"') and line.endswith('"'):
                            line = line[1:-1]
                        if line and line not in ['actions', 'Actions', '[', ']']:
                            actions.append(line)
                
                return {"actions": actions if actions else [action_text]}
    except Exception as e:
        return {"error": f"Error generating action items: {str(e)}"}





# Function to allow continuous questioning based on the predefined transcript
@app.post("/chatbot")
async def chatbot(input_data: QuestionInput):
    # Ensure transcript exists
    print("input_data", TRANSCRIPT_PATH)
    if not os.path.exists(TRANSCRIPT_PATH):
        raise HTTPException(status_code=404, detail="Transcript file not found.")

    try:
        with open(TRANSCRIPT_PATH, "r", encoding="utf-8") as f:
            transcript_text = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading transcript: {str(e)}")
    
    print("transcript_text", transcript_text)

    chatbot_messages = [
        {"role": "system", "content": "You are an assistant. Answer questions only based on the transcript provided."},
        {"role": "user", "content": f"Here is the transcript: {transcript_text}"},
        {"role": "user", "content": input_data.question}
    ]

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=chatbot_messages
        )
        answer = response.choices[0].message.content
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")








# Define the combined prompt template for the meeting data extraction
combined_prompt_template11 = PromptTemplate(
    input_variables=["transcript"],
    template="""
    You are an expert in summarizing business meetings. Based on the following meeting transcript, provide the following:

    1. **Meeting Title**: Determine the main title or subject of the meeting. The title should succinctly describe the overall purpose of the meeting.

    2. **Agenda Items**: Extract the key agenda items discussed during the meeting. Provide them in a bulleted list, ensuring that the items are clearly defined.

    3. **Summary**: Generate a structured summary covering:
       - Meeting Objective
       - Key Discussion Points
       Provide the summary in clearly labeled sections using bullet points where appropriate.

    4. **Action Items**: Extract all action items discussed or assigned during the meeting. List each action item in bullet points and include the person responsible if mentioned.

    Transcript:
    {transcript}
    """
)

# Create a single chain using the combined prompt
combined_chain = LLMChain(prompt=combined_prompt_template11, llm=llm)

# Function to extract meeting data from transcript
def extract_meeting_data(transcript_text):
    result = combined_chain.run({"transcript": transcript_text})

    # Process the result to organize the data into appropriate sections
    meeting_data = {
        "meeting_title": "", 
        "agenda_items": [],
        "summary": "",
        "action_items": []
    }

    # Parse result (assuming the output will have the sections we need)
    sections = result.split("\n")
    for section in sections:
        if section.startswith("1. **Meeting Title**:"):
            meeting_data["meeting_title"] = section.replace("1. **Meeting Title**:", "").strip()
        elif section.startswith("2. **Agenda Items**:"):
            meeting_data["agenda_items"] = section.replace("2. **Agenda Items**:", "").strip().split("\n")
        elif section.startswith("3. **Summary**:"):
            meeting_data["summary"] = section.replace("3. **Summary**:", "").strip()
        elif section.startswith("4. **Action Items**:"):
            meeting_data["action_items"] = section.replace("4. **Action Items**:", "").strip().split("\n")
    
    return meeting_data


class MeetingPDF(FPDF):
    def header(self):
        self.set_font("Arial", "B", 14)
        self.set_text_color(0, 0, 0)  # Black text color
        self.cell(0, 10, "Minutes of Meeting", ln=True, align="C")
        self.ln(6)

    def section_title(self, title):
        self.set_font("Arial", "B", 12)
        self.set_text_color(0, 0, 0)  # Black text color
        self.cell(0, 8, title, ln=True, align="L")
        self.ln(2)

    def section_body(self, body, line_height=6):
        self.set_font("Arial", "", 11)
        self.set_text_color(0, 0, 0)  # Black text color
        self.multi_cell(0, line_height, body)
        self.ln(1)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "I", 10)
        self.set_text_color(128, 128, 128)  # Gray text color for footer
        self.cell(0, 10, f"Prepared by: Meet Mind AI", 0, 0, "C")




@app.post("/download-report/")
async def write_meeting_pdf_from_transcript(payload: TranscriptInput):    # Extract data using GPT model
    meeting_data = extract_meeting_data(payload.transcript_text)

    # Extract individual fields from the result
    meeting_title = meeting_data["meeting_title"]
    agenda_items = meeting_data["agenda_items"]
    summary = meeting_data["summary"]
    action_items = meeting_data["action_items"]

    # Create the PDF from the extracted meeting data
    pdf = MeetingPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Date and Title
    pdf.set_font("Arial", "", 11)
    pdf.set_text_color(0, 0, 0)  # Black text color for date and title
    pdf.cell(0, 8, f"Meeting Title: {meeting_title}", ln=True)
    pdf.ln(5)

    # Agenda Section
    pdf.section_title("Agenda")
    for i, item in enumerate(agenda_items, 1):
        pdf.section_body(f"{i}. {item}", line_height=6)

    # Summary Section
    pdf.section_title("Summary")
    pdf.section_body(summary.strip(), line_height=6)

    # Action Items Section
    pdf.section_title("Action Items")
    if action_items:
        for i, action in enumerate(action_items, 1):
            pdf.section_body(f"{i}. {action}", line_height=6)
    else:
        pdf.section_body("No specific action items recorded.", line_height=6)

    # Save the PDF
    pdf.output(payload.filename)
    print(f"✅ Meeting PDF saved as: {payload.filename}")
    # return {"message": f"Meeting PDF saved as: {payload.filename}"}

    return FileResponse(
    path=payload.filename,
    filename=payload.filename,
    media_type='application/pdf'
)





