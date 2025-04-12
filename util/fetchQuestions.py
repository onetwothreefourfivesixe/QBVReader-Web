import re
import urllib.parse
import requests

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
    encoded_params = urllib.parse.urlencode(params, safe=",")

    try:
        response = requests.get(url, params=encoded_params)
        response.raise_for_status()
        data = response.json()
        tossup = data['tossups'][0]
        return tossup['question_sanitized'], tossup['answer_sanitized'], tossup['answer'], tossup['set']['name']
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