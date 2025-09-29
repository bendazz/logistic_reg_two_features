Logistic Regression — Two Features (Frontend)

This is a lightweight, framework-free web app to help students explore a binary classification dataset with two features (x1, x2). It renders a scatter plot and lets users download the data as CSV.

Features
- Synthetic, reproducible dataset with two Gaussian clusters (balanced classes)
- Interactive scatter plot (Chart.js) with light theme
- Hover tooltips with coordinates
- One-click CSV download (columns: x1, x2, y)

Files
- index.html — Entry point (loads Chart.js via CDN)
- style.css — Light theme styling
- app.js — Data generation, chart rendering, CSV export

How to run locally
1) Use any static HTTP server. For example, with Python installed:
	 - Python 3:
		 python3 -m http.server 8000
	 Then open http://localhost:8000 in your browser.

2) Alternatively, with Node installed:
		 npx serve .

What students see
- A scatter plot of points (x1 vs x2) colored by class: blue (0) and red (1)
- A counter with the total number of points
- A “Download CSV” button to save the current dataset

Notes
- The data is synthetic and reproducible via a seeded RNG in app.js.
- No frameworks are used; only Chart.js is loaded from a CDN for the chart.
# logistic_reg_two_features