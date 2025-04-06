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

from datetime import datetime
from icalendar import Calendar, Event, vCalAddress, vText
from fastapi.responses import StreamingResponse
import io

from jira import JIRA

# Jira server URL
jira_server = 'https://aathirai1234.atlassian.net'

# Authentication using email and PAT
jira_options = {'server': jira_server}
jira = JIRA(options=jira_options, basic_auth=('aathirai1234@gmail.com', "<REDACTED_JIRA_TOKEN>" # Replace with your actual auth key (base64 encoded string)
))
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

# Add this Pydantic model with your other models
class CalendarEventRequest(BaseModel):
    transcript: str = ""



def assign_speakers_with_gpt(transcript_text, model="gpt-4"):
    prompt = f"""
You are given a transcript of a two-speaker conversation. Your task is to:

1.⁠ ⁠Identify when each speaker is talking.
2.⁠ ⁠If speaker names are clearly mentioned (e.g., "Hi John", "Thanks, Sarah"), use those names for labeling.
3.⁠ ⁠If names are not clearly identifiable, label the speakers as "Speaker 1" and "Speaker 2".
4.⁠ ⁠Format the conversation as a dialogue, with each speaker's turn on a new line and prefixed by their label, like:

Speaker 1: Hello! I just wanted to check in on the status of the project.
Speaker 2: Sure! We're almost done, just a few final touches left.

Avoid long blocks of text; keep each speaker's turn distinct and readable.

Transcript:
\"\"\"
{transcript_text}
\"\"\"

Now return the labeled transcript:
"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful assistant that formats transcripts."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )

    labeled_transcript = response.choices[0].message.content.strip()

    # Normalize line endings
    normalized_transcript = "\n".join(
        [line.strip() for line in labeled_transcript.splitlines() if line.strip()]
    )

    return normalized_transcript



@app.post("/transcribe-audio/")
async def transcribe_audio(file: UploadFile = File(...), language_code: str = "en"):
    ext = os.path.splitext(file.filename)[-1].lower()

    if ext not in SUPPORTED_FILE_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: {ext}. Supported formats: {', '.join(SUPPORTED_FILE_FORMATS)}"
        )

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

        transcript_text = transcription.text.strip()
        labeled_transcript = assign_speakers_with_gpt(transcript_text)
        # Save the transcript to the specified path
        with open(TRANSCRIPT_PATH, "w", encoding="utf-8") as f:
            f.write(transcript_text)

        print("transcription", labeled_transcript)
        return {"transcript": labeled_transcript}

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

    print("translation", translation)
    return {"translated_text": translation.strip()}





@app.post("/analyze-tone/")
async def analyze_tone(payload: TranscriptInput = None):
    tone_emoji_mapping = {
        "confident": "💪",
        "enthusiastic": "😃",
        "neutral": "😐",
        "uncertain": "🤔",
        "frustrated": "😤",
        "persuasive": "🗣️",
        "empathetic": "💖"
    }

    # Try to get transcript from request body first
    transcript_text = None
    if payload and payload.transcript_text:
        transcript_text = payload.transcript_text
    # Fallback to file if no transcript provided in request
    else:
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



def create_jira_issue(issue_dict,transition):
  issue = jira.create_issue(fields=issue_dict)
  print(f"✅ Created: {issue.key}")

  # Step 2: Get available transitions from current state
  transitions = jira.transitions(issue)

  # Debug print to see available transitions
  print("\n🔁 Available transitions:")
  for t in transitions:
      print(f"- {t['name']} (ID: {t['id']})")

  # Step 3: Find and apply the "Contract Sent" transition
  contract_sent_id = next((t['id'] for t in transitions if t['name'].lower() == transition), None)

  if contract_sent_id:
      jira.transition_issue(issue, contract_sent_id)
      print(f"🚀 {issue.key} moved to {transition}")
  else:
      print("❌ 'Contract Sent' transition not available. Check workflow or status.")


prompt_template_jira = PromptTemplate(
    input_variables=["transcript", "transition_names"],
    template="""
You are an expert in analyzing sales call transcripts and extracting deal-related information.
Given the transcript below, extract the following details:

- Deal Name
- Key discussion points from the meeting

These are the available transition names:
["new",
    "follow-up",
    "contract sent",
    "negotiation",
    "closed won",
    "closed lost"]

Provide the extracted details as a JSON object in this format:
{{
    "project": {{
        "key": "HAC"  # The project key (can be replaced based on project)
    }},
    "summary": "Deal Name",  # The summary or title of the deal
    "description": "Brief discussion about the meeting",  # Key points from the meeting
    "issuetype": {{
        "id": "10001"  # The ID for your issue type (e.g., 'Customer')
    }},
    "transition_name": "Choose one of the transition names available"  # Transition stage like 'contractsent'
}}

Transcript:
{transcript}
"""
)

@app.post("/jira-deal-creation/")
async def jira_deal_creatition(payload: TranscriptInput):
    transcript_text = payload.transcript_text

    llm_chain_jira = LLMChain(llm=llm, prompt=prompt_template_jira, verbose=True)
    extracted_details = llm_chain_jira.run({"transcript": transcript_text})

    new_deal = json.loads(extracted_details)
    deal_details = {key: value for key, value in new_deal.items() if key != 'transition_name'}
    transition_name = new_deal['transition_name']

    output = create_jira_issue(deal_details, transition_name)
    return output




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

    meeting_data = {
        "meeting_title": "",
        "agenda_items": [],
        "summary": "",
        "action_items": []
    }

    # Use regex to extract each section
    title_match = re.search(r"\*\*Meeting Title\*\*:\s*(.*)", result)
    agenda_match = re.search(r"\*\*Agenda Items\*\*:\s*((?:- .*\n?)+)", result)
    summary_match = re.search(r"\*\*Summary\*\*:\s*((?:.|\n)*?)(?=\*\*Action Items\*\*|$)", result)
    action_match = re.search(r"\*\*Action Items\*\*:\s*((?:- .*\n?)+)", result)

    if title_match:
        meeting_data["meeting_title"] = title_match.group(1).strip()

    if agenda_match:
        agenda_items = [item.strip("- ").strip() for item in agenda_match.group(1).strip().split("\n") if item.strip()]
        meeting_data["agenda_items"] = agenda_items

    if summary_match:
        meeting_data["summary"] = summary_match.group(1).strip()

    if action_match:
        action_items = [item.strip("- ").strip() for item in action_match.group(1).strip().split("\n") if item.strip()]
        meeting_data["action_items"] = action_items

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




# Add this endpoint to your app
@app.post("/download-calendar/")
async def download_calendar(input_data: CalendarEventRequest):
    """Generate and download calendar file directly from transcript"""
    try:
        # Get transcript from request or from file if empty
        transcript_text = input_data.transcript

        if not transcript_text:
            # Try to get transcript from the file (using your existing pattern)
            if not os.path.exists(TRANSCRIPT_PATH):
                raise HTTPException(status_code=404, detail="Transcript file not found.")

            try:
                with open(TRANSCRIPT_PATH, "r", encoding="utf-8") as f:
                    transcript_text = f.read()
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error reading transcript file: {str(e)}")

        # Extract events using GPT
        prompt = f"""
        Extract any scheduled events mentioned in the transcript:

        {transcript_text}

        Format your response as a JSON array of events with these fields:
        - title: Event title
        - date: YYYY-MM-DD
        - start_time: HH:MM (24-hour)
        - end_time: HH:MM (24-hour)
        - description: Brief description
        - attendees: Comma-separated list of people

        If no events are found, return an empty array.
        """

        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are an assistant that extracts calendar events from transcripts into structured data."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="gpt-4o-mini",
            max_tokens=800
        )

        response_text = chat_completion.choices[0].message.content.strip()

        # Handle JSON extraction from response
        events = []
        try:
            # Clean up response if it contains markdown or explanations
            if "```json" in response_text:
                match = re.search(r'```(?:json)?(.*?)```', response_text, re.DOTALL)
                if match:
                    response_text = match.group(1).strip()
            events = json.loads(response_text)
        except json.JSONDecodeError:
            # Create a default event if parsing fails
            today = datetime.today().strftime('%Y-%m-%d')
            events = [{
                "title": "Meeting Follow-up",
                "date": today,
                "start_time": "09:00",
                "end_time": "10:00",
                "description": "Follow-up to meeting discussion",
                "attendees": "Meeting participants"
            }]

        # Generate ICS file
        cal = Calendar()
        cal.add('prodid', '-//Meeting Event Extractor//EN//')
        cal.add('version', '2.0')

        for event_data in events:
            event = Event()
            event.add('summary', event_data.get('title', 'Untitled Event'))

            date_str = event_data.get('date', datetime.today().strftime('%Y-%m-%d'))
            start_time_str = event_data.get('start_time', '09:00')
            end_time_str = event_data.get('end_time', '10:00')

            try:
                start_dt = datetime.strptime(f"{date_str} {start_time_str}", "%Y-%m-%d %H:%M")
                end_dt = datetime.strptime(f"{date_str} {end_time_str}", "%Y-%m-%d %H:%M")
            except ValueError:
                today = datetime.today().strftime('%Y-%m-%d')
                start_dt = datetime.strptime(f"{today} 09:00", "%Y-%m-%d %H:%M")
                end_dt = datetime.strptime(f"{today} 10:00", "%Y-%m-%d %H:%M")

            event.add('dtstart', start_dt)
            event.add('dtend', end_dt)
            event.add('description', event_data.get('description', 'No description provided'))

            # Add attendees
            attendees = event_data.get('attendees', '')
            attendee_list = []

            if isinstance(attendees, list):
                attendee_list = attendees
            elif isinstance(attendees, str) and attendees:
                attendee_list = [att.strip() for att in attendees.split(',') if att.strip()]

            for attendee in attendee_list:
                if attendee:
                    attendee_addr = vCalAddress(f'MAILTO:{str(attendee).replace(" ", "").lower()}@example.com')
                    attendee_addr.params['cn'] = vText(str(attendee))
                    event.add('attendee', attendee_addr, encode=0)

            cal.add_component(event)

        # Create a file-like object for the ICS
        ics_data = cal.to_ical()
        ics_file = io.BytesIO(ics_data)

        # Return as a downloadable file
        return StreamingResponse(
            iter([ics_file.getvalue()]),
            media_type="text/calendar",
            headers={
                "Content-Disposition": "attachment; filename=meeting_events.ics"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating calendar: {str(e)}")