import os
import math
import torch
from flask import Flask, request, jsonify, render_template, url_for, Blueprint, redirect, session
from flask_cors import CORS
import json
from json.decoder import JSONDecodeError
from transformers import AutoTokenizer, T5ForConditionalGeneration
import re
from datetime import datetime
import requests
import random
import csv

# === APP SETUP ===

typingPage = Blueprint('typing', __name__, template_folder='templates', static_folder='static')

# Ensure a folder for participant logs
LOGS_DIR = os.path.join(os.getcwd(), 'logs')
os.makedirs(LOGS_DIR, exist_ok=True)

TRIALS_DIR = os.path.join(os.getcwd(), 'trials')
os.makedirs(TRIALS_DIR, exist_ok=True)

RESULT_DIR = os.path.join(os.getcwd(), 'results')
os.makedirs(RESULT_DIR, exist_ok=True)

# Path for our JSON registry
PARTICIPANTS_FILE = os.path.join(LOGS_DIR, 'participants.json')
if not os.path.exists(PARTICIPANTS_FILE):
    with open(PARTICIPANTS_FILE, 'w') as f:
        json.dump([], f)


# counter balance
COUNTER_LAVELS = [[2, 3, 4],
    [2, 4, 3],
    [4, 2, 3],
    [4, 3, 2],
    [3, 4, 2],
    [3, 2, 4]]

PRESSURE_LEVELS = {
    2: ["light", "full"],
    3: ["light", "medium", "full"],
    4: ["light", "mediumLow", "mediumHigh", "full"]
}

BLOCK_COUNT = 6

KEYS = ["4", "22", "7", "9", "11", "13", "14", "15"]



def createTrials(id):
    trials_level = []
    log_status = {}
    PARTICIPANTS_FILE = os.path.join(TRIALS_DIR, id + '.json')
    if not os.path.exists(PARTICIPANTS_FILE):
        with open(PARTICIPANTS_FILE, 'w') as f:
            trials_level.clear()

            counter_levels = COUNTER_LAVELS[int(id) % 6]
            
            for levels in counter_levels:
                LEVELS = PRESSURE_LEVELS[levels]
                trials_block = []
                for block in range(BLOCK_COUNT):
                    sequence = []
                    for level in LEVELS:
                        for key in KEYS:
                            sequence.append({"pressure": level, "key": key})
                    
                    random.shuffle(sequence)
                    trials_block.append({"block": block, "sequence": sequence})
                
                trials_level.append({"levelCount": levels, "trialBlock": trials_block})

            # print(trials_level)
            f.write(json.dumps(trials_level))

    log_status = {"level": 0, "block": 0, "trial": 0}

    PARTICIPANTS_logs = os.path.join(LOGS_DIR, id + '.json')
    if not os.path.exists(PARTICIPANTS_logs):
        with open(PARTICIPANTS_logs, 'w') as f:
            f.write(json.dumps(log_status))

    PARTICIPANTS_results = os.path.join(RESULT_DIR, id + '.csv')
    if not os.path.exists(PARTICIPANTS_results):
        with open(PARTICIPANTS_results, 'w', newline='') as csvfile:
            fieldnames = ['id', 'level','block', 'trial', 'levelCounts', 'targetKey', 'targetLevel', 'pressedLevel', 'pressedRaw', 'isSuccessful', 'startTime', 'endTime', 'time']

            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()

    return trials_level, log_status



# === New: Participant registration endpoint ===
@typingPage.route("/register", methods=["POST"])
def register():
    # Process the form data
    raw_id = request.form['id']
    print("register:" + raw_id)

    try:
        with open(PARTICIPANTS_FILE, 'r') as f:
            participants = json.load(f)
    except (FileNotFoundError, JSONDecodeError):
        participants = []

    if raw_id not in participants:
        # the first time for current ID, create trials file and block file.
        print("create")
        trials_level, log_status = createTrials(raw_id)

        participants.append(raw_id)
        with open(PARTICIPANTS_FILE, 'w') as f:
            json.dump(participants, f, indent=2)
    else:
        # read the status from the log file
        TRIALS_FILE = os.path.join(TRIALS_DIR, raw_id + '.json')
        with open(TRIALS_FILE, 'r') as f:
            trials_level = json.load(f)
        
        LOG_FILE = os.path.join(LOGS_DIR, raw_id + '.json')
        with open(LOG_FILE, 'r') as f:
            log_status = json.load(f)

        # print(trials_level)
        # print(log_status["levels"])
        # print(log_status["block"])
        # print(log_status["trial"])

    session['trials'] = json.dumps(trials_level)
    session['status'] = json.dumps(log_status)
    session['id'] = json.dumps({"id": raw_id})

    # return jsonify(id=new_id)
    return redirect(url_for('.study'))

# === New: serve the study page ===
@typingPage.route("/study")
def study():
    print("study")
    # print(session['trials'])
    print(session['status'])
    return render_template('user-study.html', ID = session["id"], TRAILS = session['trials'], STATUS = session['status'])
    
@typingPage.route("/training")
def training():
    return render_template('training.html')

#view function for indoor games option present on HTML page
@typingPage.route('/experiment')
def experiment():
    return render_template('experiment.html')

@typingPage.route('/')
def welcome():
    return render_template('index.html')

@typingPage.route("/endblock", methods=["POST"])
def endblock():
    print("endblock")
    status = json.loads(session['status'])
    id = json.loads(session['id'])
    print(status)
    level = status['level']
    block = status['block']
    trial = status['trial']

    trial = 0
    block += 1

    if block == 6:
        block = 0
        level += 1
    
    log_status = {"level": level, "block": block, "trial": trial}
    session['status'] = json.dumps(log_status)

    LOG_FILE = os.path.join(LOGS_DIR, id['id'] + '.json')
    with open(LOG_FILE, 'w') as f:
        f.write(json.dumps(log_status))

    if level == 3:
        #end of study
        return redirect(url_for('.experiment'))
    else:
        return redirect(url_for('.study'))


@typingPage.route('/api/debug', methods=["POST"])
def frontend_debug():
    try:
        string = request.json.get("string", "")
        print(string)
        return jsonify("")

    except Exception as e:
        return jsonify(error=str(e)), 500

@typingPage.route('/api/log', methods=["POST"])
def log():
    data = request.json
    print(data)

    PARTICIPANTS_results = os.path.join(RESULT_DIR, data["result"]["id"] + '.csv')
    with open(PARTICIPANTS_results, 'a', newline='') as csvfile:
        fieldnames = ['id', 'level','block', 'trial', 'levelCounts', 'targetKey', 'targetLevel', 'pressedLevel', 'pressedRaw', 'isSuccessful', 'startTime', 'endTime', 'time']

        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writerow(data["result"]) 

    LOG_FILE = os.path.join(LOGS_DIR, data["updateinfo"]["id"] + '.json')

    print(data["updateinfo"])

    session['status'] = json.dumps(data["updateinfo"])

    with open(LOG_FILE, 'w') as f:
        f.write(json.dumps(data["updateinfo"]))

    return {"message": "Data received", "data": data}


app = Flask(__name__)
app.secret_key = "A.L6Ht.68}=R7mQ7_zRn0Vi+v"
app.register_blueprint(typingPage, url_prefix='/typing')
CORS(app)

if __name__ == "__main__":
    app.run(port=1111, debug=True)