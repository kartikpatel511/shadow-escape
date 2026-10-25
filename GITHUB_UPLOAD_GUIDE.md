# Publish RIFTBOUND to GitHub for your hackathon

This folder already contains the full Step 13 source, a judge-friendly `README.md`, a `.gitignore`, and a GitHub Actions test workflow. The game code itself has not been modified for publication.

## Option A — GitHub website (no commands)

1. Sign in to [GitHub](https://github.com).
2. Open [Create new repository](https://github.com/new).
3. Enter repository name **riftbound-escape-the-veil** (or any unique name you want). Set **Public** if judges must view the code.
4. **Do not** tick the options to add a README, .gitignore, or license: this project already has the first two. Click **Create repository**.
5. From the empty repository's page choose **uploading an existing file** (or **Add file → Upload files**).
6. Extract `SHADOW_ESCAPE_GITHUB_READY.zip` on your computer, open the extracted folder, and drag **all the files and folders inside it** onto the GitHub upload area. You must upload the **extracted source files**, not the ZIP itself.
7. Click **Commit changes**.
8. Copy the URL shown in the address bar. It should look like `https://github.com/YOUR_USERNAME/riftbound-escape-the-veil` — this is your **Git repository link** for the submission.

If the web upload won't accept a folder, use Option B instead.

## Option B — Git command line

Create an **empty** repository at <https://github.com/new> first. Extract the supplied project ZIP and open a terminal inside the directory containing `package.json`.

```bash
git init -b main
git add .
git commit -m "Add RIFTBOUND hackathon game"
git remote add origin https://github.com/YOUR_USERNAME/riftbound-escape-the-veil.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. GitHub may prompt you to sign in; do not share your password or token in chat. If you need to configure your Git name/email, follow Git's prompts using your own identity. You can also publish using GitHub Desktop.

## Important: GitHub link vs live game link

Your **GitHub repo link** is for the judges to read/download the code. It is **not** a running game website. The actual game needs a Node.js host with WebSocket support; don't use GitHub Pages as the multiplayer server.

You can test locally before submission:

```bash
npm run check
npm start
```

Then open <http://localhost:3000>.
