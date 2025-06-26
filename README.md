# OpenCanvas - Take notes, sketch, journal and collaborate all in one free app.

# Demo - https://open-canvas-kappa.vercel.app/

![image](https://github.com/user-attachments/assets/037b277d-4ea2-4f92-b1dc-9011a08c5b3f)

## Features

- Open source & 100% free. Forever.
- Export current Canvas as JPEG/PNG
- 100% local storage - offline & private.
- Colored paper with dot grid, squared, lined or blank styles
- **Secret sharing links** → unique URLs that let others access a document
- **Real-time collaboration** → live syncing between users on the same doc

## ✨ New Collaboration Features

### Secret Links
Click the "Share" button on any document to generate a unique, secret link that you can share with others. Anyone with the link can view and collaborate on your document in real-time.

### Real-time Collaboration
When multiple users are on the same shared document:
- All drawing actions sync instantly between users
- See live cursor movements from other collaborators
- Each user gets a unique color indicator
- No account or login required

### How it Works
- Uses multiple communication channels for maximum compatibility:
  - **BroadcastChannel API** for same-origin real-time communication  
  - **localStorage events** for cross-tab communication
  - **Event polling** as fallback for all scenarios
- Documents are temporarily shared via browser storage
- No server required - completely peer-to-peer
- **Works across different browser contexts** including private/incognito tabs
- Private and secure - data stays in your browser

### Usage
1. Create or open a document
2. Click the "Share" button in the top toolbar
3. Click "Generate Share Link" 
4. Copy the generated link and share it with others
5. Others can open the link in **any browser tab** (including private/incognito)
6. Start drawing together in real-time!

**✅ Now works in private/incognito tabs and across different browser contexts!**

## Running Locally

To run OpenCanvas on your local machine:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Veeeetzzzz/OpenCanvas.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd OpenCanvas
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    # or yarn install
    ```
4.  **Start the development server:**
    ```bash
    npm run dev
    # or yarn dev
    ```
5.  Open your browser and navigate to the local URL provided (usually `http://localhost:5173`).

## Contribution

You can submit your issues/ideas/feedback via the Issues tab. 
