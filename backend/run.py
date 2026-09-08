import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Windows venv + Werkzeug reloader can nest extra python.exe processes,
    # each holding Supabase session-mode clients until the 15-client cap.
    use_reloader = os.name != "nt"
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=use_reloader, threaded=True)
