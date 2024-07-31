let mediaRecorder;
let recordedChunks = [];
let recordings = [];
let selectedRecording = null;
let wavesurfer;

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'audio/wav' });
                recordedChunks = [];
                const url = URL.createObjectURL(blob);
                addRecordingToList(url, blob);
            };

            mediaRecorder.start();
            document.getElementById('start-recording').innerText = "Stop Recording";
            document.getElementById('start-recording').onclick = stopRecording;
        })
        .catch(error => console.error('Error accessing audio devices:', error));
}

function stopRecording() {
    mediaRecorder.stop();
    document.getElementById('start-recording').innerText = "Start Recording";
    document.getElementById('start-recording').onclick = startRecording;
}

function addRecordingToList(url, blob) {
    const recordingsList = document.getElementById('recordings-list');
    const recordingElement = document.createElement('div');
    recordingElement.classList.add('recording');
    recordingElement.innerText = `Recording ${recordings.length + 1}`;
    recordingElement.onclick = () => selectRecording(url, blob);
    recordingsList.appendChild(recordingElement);

    recordings.push({ url, blob });
}

function selectRecording(url, blob) {
    selectedRecording = { url, blob };
    displayRecordingInfo(url);
}

function displayRecordingInfo(url) {
    if (!wavesurfer) {
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: 'violet',
            progressColor: 'purple',
            barWidth: 3,
            barHeight: 1,
            barGap: 1
        });
    }
    wavesurfer.load(url);
    console.log(selectedRecording.blob);
}

function playAudio() {
    if (wavesurfer) {
        wavesurfer.playPause();
    }
}

async function transcribe() {
    console.log("Entered into transcribe");
    if (selectedRecording) {
        document.getElementById('transcript').value = "Transcription in progress, please wait...";
        const formData = new FormData();
        formData.append('file', selectedRecording.blob);

        try {
            const response = await fetch('https://checking-aws-api.vercel.app/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            console.log(data);

            const jobId = data.jobId;

            const checkTranscription = async () => {
                const transcriptionResponse = await fetch(`https://checking-aws-api.vercel.app/transcription/${jobId}`);

                if (!transcriptionResponse.ok) {
                    throw new Error('Network response was not ok');
                }

                const transcriptionData = await transcriptionResponse.json();

                if (transcriptionData.transcriptionText) {
                    document.getElementById('transcript').value = transcriptionData.transcriptionText;
                } else {
                    setTimeout(checkTranscription, 5000); // Check every 5 seconds
                }
            };

            checkTranscription();
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('transcript').value = 'An error occurred during transcription.';
        }
    }
}

function deleteAllRecordings() {
    document.getElementById('recordings-list').innerHTML = '';
    recordings = [];
    if (wavesurfer) {
        wavesurfer.destroy();
        wavesurfer = null;
    }
}

function askQuestion() {
    const transcript = document.getElementById('transcript').value;
    const question = document.getElementById('question').value;

    appendMessage(question, 'user-message');

    fetch('http://127.0.0.1:3000/ask', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript, question }),
    })
    .then(response => response.json())
    .then(data => {
        appendMessage(data.answer, 'bot-message');
        document.getElementById('question').value = '';
    })
    .catch(error => {
        console.error('Error:', error);
        appendMessage('An error occurred while processing your request.', 'bot-message');
    });
}

function appendMessage(message, className) {
    const chatWindow = document.getElementById('chat-window');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', className);
    messageElement.textContent = message;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}
