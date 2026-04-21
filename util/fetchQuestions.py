import re
import urllib.parse
import requests

def is_empty(val):
    if val is None:
        return True
    if isinstance(val, str) and val.strip() in {"", "[]", "None"}:
        return True
    if isinstance(val, (list, tuple, set, dict)) and len(val) == 0:
        return True
    return False


def fetchTossup(difficulties='', categories='', subcategories=''):
    url = 'https://www.qbreader.org/api/random-tossup'
    params = {
        'difficulties': str(difficulties),
        'categories': re.sub(r'[;:!*[\]"\']', '', categories).replace(', ', ','),
        'subcategories': re.sub(r'[;:!*[\]"\']', '', subcategories).replace(', ', ','),
        'number': 1,
        'minYear': 2014,
        'maxYear': 2024,
        'powermarkOnly': True,
        'standardOnly': True
    }
    params = {k: v for k, v in params.items() if not is_empty(v)}
    encoded_params = urllib.parse.urlencode(params, safe=",")

    try:
        response = requests.get(url, params=encoded_params)
        response.raise_for_status()
        data = response.json()
        tossup = data['tossups'][0]
        
        original_text = tossup['question_sanitized']

        return original_text, tossup['answer_sanitized'], tossup['answer'], tossup['set']['name']
    except requests.exceptions.RequestException as e:
        print(f"Error fetching tossup: {e}")
        return None
def checkTossupAnswer(answerLine: str='', givenAnswer: str=''):
    url = 'https://www.qbreader.org/api/check-answer'
    
    params = {
        'answerline': answerLine,
        'givenAnswer': givenAnswer
    }
    encoded_params = urllib.parse.urlencode(params, safe=",")
    try:
        response = requests.get(url, params=encoded_params)
        response.raise_for_status()
        data = response.json()
        return data.get('directive', 'reject')  # Default to reject if no directive found
    except requests.exceptions.RequestException as e:
        print(f"Error checking answer: {e}")
        return 'reject'  # Default to reject on error