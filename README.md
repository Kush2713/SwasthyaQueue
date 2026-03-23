\# 🏥 SwasthyaQueue – AI Powered Hospital Queue System



\## Overview



SwasthyaQueue is a smart hospital queue management system that uses \*\*Machine Learning\*\* to prioritize patients based on severity.



\---



\## Tech Stack



\### Backend



\* Node.js

\* Express.js

\* PostgreSQL



\### ML Service



\* Python

\* Flask

\* Scikit-learn (Decision Tree)



\---



\## System Architecture



```text

Frontend → Backend (Node.js) → ML API (Flask) → Database (PostgreSQL)

```



\---



\## Setup Instructions



\### 1. Clone Repository



```bash

git clone https://github.com/Kush2713/SwasthyaQueue.git

cd SwasthyaQueue

```



\---



\### 2. Backend Setup



```bash

cd backend

npm install

```



Create `.env` file:



```env

DB\_USER=your\_user

DB\_PASSWORD=your\_password

DB\_HOST=localhost

DB\_PORT=5432

DB\_NAME=your\_database

```



Run backend:



```bash

node server.js

```



Backend runs on:



```text

http://localhost:5000

```



\---



\### 3. ML Service Setup



```bash

cd ml-service

pip install -r requirements.txt

python app.py

```



ML runs on:



```text

http://127.0.0.1:5001

```



\---



\## 🔗 Important API Endpoints



\### ➤ Add Patient to Queue



POST `/api/queue/add`



```json

{

&#x20; "patient\_id": 1,

&#x20; "department\_id": 1,

&#x20; "symptoms": "chest pain",

&#x20; "pain\_scale": 9,

&#x20; "age": 65

}

```



\---



\### ➤ Get Queue by Department



GET `/api/queue/:department\_id`



\---



\### ➤ Check Patient Turn



POST `/api/queue/check-turn`



\---



\### ➤ Call Next Patient



POST `/api/queue/next`



\---



\### ➤ Complete Patient



POST `/api/queue/complete`



\---



\## ML Integration



\* Backend calls ML API:



```text

POST http://127.0.0.1:5001/predict

```



\* ML returns:



```json

{

&#x20; "priority": 1

}

```



\---



\## 👨‍💻 Frontend Developer Guide



👉 Frontend should:



* Call backend APIs (`http://localhost:5000`)
* Send JSON data
* Display queue + wait time
* Show patient priority



👉 Important:



```text

Backend must be running before frontend

ML service must also be running

```



\---



\## Contributors



* Chirag Agrawal (Frontend)
* Kushagra Sharma (Backend)
* Lipika Kaushal (ML)



\---



\## Future Improvements



* Real dataset for ML model
* Better symptom classification
* UI Dashboard (React)
* Deployment (Cloud)



