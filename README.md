# AI-Powered-Task-Automation-Tool


### The Smart Task Summarizer + Tagger

This project is a full-stack, AI-powered utility designed to automate the process of organizing unstructured task descriptions. It provides a simple web interface for project managers to input messy notes and instantly receive a structured list of tasks, complete with summaries, relevant tags, and priority scores. The tool also includes a robust no-code automation pipeline to integrate with third-party tools.

-----

## Features

  - **AI-Powered Summarization:** Automatically generates short, clear summaries from lengthy, unstructured task descriptions.
  - **Dynamic Tagging:** Assigns relevant tags (e.g., `#urgent`, `#frontend`, `#client`) to each task based on its content.
  - **Intelligent Prioritization:** Assigns a priority score (1–5) based on keywords, urgency, and context.
  - **No-Code Automation:** A separate n8n workflow automates the entire process, from a Google Sheets trigger to a summary email.
  - **Data Export:** Allows users to export the cleaned-up task list as a CSV file.
  - **Configurable AI:** Users can customize the priority scale and the number of tags directly from the frontend.

-----

## Technology Stack

### Backend & AI Logic

  - **Python Flask:** A lightweight web framework for building the application's RESTful API.
  - **Google Gemini API:** The core AI engine used for natural language processing, summarization, and tagging.
  - **In-Memory Storage:** A simple Python list is used for temporary storage of processed tasks.

### Frontend

  - **Plain HTML, CSS, JavaScript:** A clean, responsive user interface built without heavy frameworks for fast performance and easy maintenance.
  - **Font Awesome:** Used for icons and visual elements.

### Automation

  - **n8n:** A powerful workflow automation tool used to create a scheduled, proactive workflow that connects Google Sheets to the Flask API and then to Gmail.

-----

## How It Works

### 1\. Manual Workflow (Web Application)

  - A user pastes task descriptions into the web UI and clicks "Process."
  - The JavaScript frontend sends a `POST` request with the tasks to the Flask API endpoint `/api/tasks/process`.
  - The Flask backend calls the Gemini API with a dynamically generated prompt.
  - Gemini returns a structured JSON object, which is then parsed and displayed on the web page.

### 2\. Automated Workflow (N8n)

  - A **Google Sheets Trigger** node in n8n monitors for new tasks added to a spreadsheet.
  - A **Code** node combines all new tasks into a single JSON array.
  - An **HTTP Request** node sends a single `POST` request to the Flask API to process all the tasks at once.
  - A **Gmail** node receives the AI's structured output and sends a formatted daily summary email.

-----

## Setup and Installation

### Prerequisites

  - Python 3.11+
  - A Google Gemini API Key
  - A Replit account (optional, for easy deployment)
  - A ngrok account (for local development with n8n)

### Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/your-repo.git
    cd your-repo
    ```
2.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    *(If using `pyproject.toml`, you can use `uv` or `pip` to install from there.)*
3.  **Set your API key:**
    ```bash
    export GEMINI_API_KEY="your_api_key_here"
    ```
4.  **Run the Flask application:**
    ```bash
    python app.py
    ```
    The application will be available at `http://localhost:5001`.

-----

## Future Enhancements

  - **Persistent Storage:** Integrate a database (e.g., SQLite or PostgreSQL) to save tasks permanently.
  - **User Authentication:** Add user accounts to support multiple project managers and private task lists.
  - **Advanced Integrations:** Implement direct API calls to tools like Notion, Trello, or Asana to push processed tasks.
  - **Task Archiving:** Add a feature to archive or delete old tasks.
