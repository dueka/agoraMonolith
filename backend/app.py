import os
import tempfile
import flask
from flask import request
from flask_cors import CORS
import whisper
import base64

app = flask.Flask(__name__)
CORS(app)


@app.route('/transcribe', methods=['POST'])
# def transcribe():
#     print("request", request)
#     print("request.files", request.files)
#     print("request.form", request.form)
#     try:
#         language = request.form.get('language')
#         model = request.form.get('model_size')
#         audio_data = request.files.get('audio_data')

#         if not language or not model or not audio_data:
#             return 'Missing required fields', 400

#         # there are no english models for large
#         if model != 'large' and language == 'english':
#             model = model + '.en'
#         audio_model = whisper.load_model(model)

#         with tempfile.TemporaryDirectory() as temp_dir:
#             save_path = os.path.join(temp_dir, 'temp.wav')
#             audio_content = base64.b64decode(audio_data.read())
#             with open(save_path, 'wb') as f:
#                 f.write(audio_content)

#             if language == 'english':
#                 result = audio_model.transcribe(save_path, language='english')
#             else:
#                 result = audio_model.transcribe(save_path)

#             return result['text'], 200

#     except Exception as e:
#         print(f"Error: {e}")
#         return 'An error occurred', 500

def transcribe():
    print(request.files)
    print(request.form)
    if request.method == 'POST':
        language = request.form['language']
        model = request.form['model_size']

        # there are no english models for large
        if model != 'large' and language == 'english':
            model = model + '.en'
        audio_model = whisper.load_model(model)

        temp_dir = tempfile.mkdtemp()
        save_path = os.path.join(temp_dir, 'temp.wav')

        wav_file = request.files['audio_data']
        wav_file.save(save_path)
        if language == 'english':
            result = audio_model.transcribe(save_path, language='english')
        else:
            result = audio_model.transcribe(save_path)

        return result['text']
    else:
        return "This endpoint only processes POST wav blob"