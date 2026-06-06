---
title: Quantum Notebook Studio
emoji: 🌌
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 3000
---

# Quantum Notebook Studio 🌌

Quantum Notebook Studio is an interactive, web-based platform designed for exploring and executing quantum computing notebooks. It provides a seamless interface for visualizing quantum algorithms and phenomena in real-time.

**Live Demo**: [https://huggingface.co/spaces/paul-soporan/quantum-notebook-studio](https://huggingface.co/spaces/paul-soporan/quantum-notebook-studio)

## 🚀 Features

- **Interactive Execution**: Run Jupyter notebooks directly in the browser with real-time feedback.
- **Quantum Computing Ecosystem**: Pre-configured with [Qiskit](https://qiskit.org/), NumPy, Matplotlib, and more.
- **Modern UI**: A polished interface built with Next.js and Material UI, featuring integrated Monaco Editor support.
- **Curated Notebooks**:
  - **BB84 Quantum Key Distribution**: Learn how quantum mechanics secures communication.
  - **CHSH Bell Game**: Explore quantum correlations and entanglement.
  - **Grover Search**: Visualize quantum speedup in constraint-satisfaction problems.

## 🛠 Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/), React, Material UI, Monaco Editor.
- **Backend/Execution Engine**: Python 3.12, [uv](https://github.com/astral-sh/uv), Jupyter.
- **Quantum Stack**: Qiskit, Qiskit Aer, Qiskit Algorithms.
- **Package Management**: Yarn & `uv`.
- **Deployment**: Docker, Hugging Face Spaces.

## 🏁 Getting Started

### Prerequisites

- Node.js (v20+)
- Python (v3.12+)
- [uv](https://github.com/astral-sh/uv)
- Yarn

### Local Development

1.  **Install dependencies**:
    ```bash
    yarn install
    uv sync
    ```

2.  **Run the development server**:
    ```bash
    cd frontend
    yarn dev
    ```

3.  **Open the application**:
    Navigate to `http://localhost:3000` to explore the notebooks.

> [!TIP]
> Notebooks can be manually synchronized from the root `notebooks/` directory to the frontend's public folder using `yarn sync:notebooks` within the `frontend/` directory.

### Docker

To run the studio using Docker:

```bash
docker build -t quantum-notebook-studio .
docker run -p 3000:3000 quantum-notebook-studio
```

## 📁 Project Structure

- `frontend/`: The Next.js web application.
- `notebooks/`: Curated Jupyter notebooks for quantum exploration.
- `pyproject.toml`: Python dependencies managed by `uv`.
- `Dockerfile`: Container configuration for deployment.
