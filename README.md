# OpenCanvas - Take notes, sketch, journal and collaborate all in one free app.

# Demo - https://open-canvas-kappa.vercel.app/

![image](https://github.com/user-attachments/assets/037b277d-4ea2-4f92-b1dc-9011a08c5b3f)

## Features

- Open source & 100% free. Forever.
- Export current Canvas as JPEG/PNG
- 100% local storage - offline & private.
- Colored paper with dot grid, squared, lined or blank styles
- **Local sharing links** -> URLs for collaborating in another normal tab in the same browser profile
- **Same-browser collaboration** -> live syncing between local tabs on the same doc

## Local Collaboration Features

### Local Links

Click the "Share" button on any document to generate a unique local link. Open it in another normal tab in the same browser profile to collaborate in real time.

### Real-time Collaboration

When multiple local tabs are on the same shared document:

- Drawing actions sync between tabs
- See connected local collaborators in the share dialog
- Each user gets a unique color indicator
- No account or login required

### How it Works

- Uses multiple communication channels for maximum compatibility:
  - **BroadcastChannel API** for same-origin real-time communication
  - **localStorage events** for cross-tab communication
  - **Event polling** as a local fallback
- Documents are shared via browser storage in the same browser profile
- No server required
- Cross-device, separate-profile, and private/incognito collaboration are not supported in this release
- Private by default - data stays in your browser

### Usage

1. Create or open a document
2. Click the "Share" button in the top toolbar
3. Click "Generate Share Link"
4. Copy the generated link and open it in another normal tab in the same browser profile
5. The second tab loads the current document snapshot
6. Start drawing together in real-time!

## Running Locally

To run OpenCanvas on your local machine:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Veeeetzzzz/OpenCanvas.git
   ```
2. **Navigate to the project directory:**
   ```bash
   cd OpenCanvas
   ```
3. **Install dependencies:**
   ```bash
   npm install
   # or yarn install
   ```
4. **Start the development server:**
   ```bash
   npm run dev
   # or yarn dev
   ```
5. Open your browser and navigate to the local URL provided (usually `http://localhost:5173`).

## Contribution

You can submit your issues/ideas/feedback via the Issues tab.
