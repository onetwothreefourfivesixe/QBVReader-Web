# Flask Application

A basic Flask application template with a modern structure.

## Setup

1. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file (optional):
```
SECRET_KEY=your-secret-key-here
```

## Running the Application

To run the application in development mode:

```bash
python app.py
```

The application will be available at `http://localhost:5000`

## Project Structure

- `app.py`: Main application file
- `templates/`: Directory containing HTML templates
- `requirements.txt`: Project dependencies
- `.env`: Environment variables (create this file) 