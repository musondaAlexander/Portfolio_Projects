# Data Analytics & Web Scraping Projects

A collection of Python-based data analytics and web scraping projects demonstrating various techniques for data extraction, cleaning, analysis, and visualization.

## 📁 Projects Overview

### 1. Automated eBay Web Scraping
**File:** `Automated Ebay Web Scrapping  Project.ipynb`

Automated web scraping system for extracting product data from eBay listings.

**Technologies:**
- BeautifulSoup4 for HTML parsing
- Requests for HTTP operations
- Pandas for data manipulation
- CSV for data storage

**Features:**
- Real-time price monitoring
- Product information extraction
- Automated data collection with timestamps
- CSV export for analysis

**Use Cases:**
- Price tracking for specific products
- Market research and competitive analysis
- Building historical pricing databases

---

### 2. Movies Correlation Analysis
**File:** `Movies_Correlation_Project.ipynb`

Statistical analysis project exploring correlations between various movie attributes (budget, revenue, ratings, etc.).

**Technologies:**
- Pandas for data manipulation
- NumPy for numerical operations
- Seaborn & Matplotlib for visualizations
- Statistical correlation analysis

**Features:**
- Missing data detection and handling
- Correlation matrix visualization
- Statistical relationship analysis
- Data visualization with multiple chart types

**Insights:**
- Relationship between budget and revenue
- Rating correlations with box office performance
- Genre and release timing impact analysis

---

### 3. MongoDB Data Analysis (Cybersecurity Lab)
**File:** `inroduction_to_mongo_db_data_analysis.ipynb`

Introduction to NoSQL database operations using MongoDB for cybersecurity attack data analysis.

**Technologies:**
- PyMongo for MongoDB connectivity
- MongoDB for NoSQL data storage
- JSON-like document structure

**Features:**
- Database connection setup
- CRUD operations (Create, Read, Update, Delete)
- Cybersecurity attack data ingestion
- Network traffic analysis

**Data Includes:**
- Source/Destination IP addresses
- Port numbers and protocols
- Packet information
- Malware indicators
- Anomaly scores

---

### 4. Automated Football News Scraping
**Folder:** `automatedScraping/`
**File:** `autofoobal.ipynb`

Automated scraper for football news headlines from The Sun Sport website.

**Technologies:**
- BeautifulSoup4 for HTML parsing
- Requests for web scraping
- Pandas for data organization

**Features:**
- Headline extraction
- Subtitle and link collection
- Automated data structuring
- CSV export (`headline.csv`)

**Output:**
- Football news headlines
- Article subtitles
- Direct links to articles

---

### 5. Lab Exercise
**File:** `lab_one (1).ipynb`

Exploratory data analysis lab exercise covering fundamental Python data analytics techniques.

---

## 🚀 Getting Started

### Prerequisites

Install required packages:

```bash
pip install pandas numpy seaborn matplotlib beautifulsoup4 requests pymongo
```

### MongoDB Setup (for MongoDB project)

1. Install MongoDB locally
2. Start MongoDB service:
   ```bash
   # Windows
   net start MongoDB
   
   # macOS/Linux
   sudo systemctl start mongod
   ```
3. MongoDB will be accessible at `mongodb://localhost:27017/`

### Running the Notebooks

1. Clone the repository
2. Navigate to the project folder
3. Launch Jupyter Notebook:
   ```bash
   jupyter notebook
   ```
4. Open any `.ipynb` file and run the cells

---

## 📊 Skills Demonstrated

### Web Scraping
- ✅ HTTP request handling
- ✅ HTML parsing with BeautifulSoup
- ✅ Data extraction from dynamic websites
- ✅ Handling user agents and headers
- ✅ Rate limiting and ethical scraping

### Data Analysis
- ✅ Data cleaning and preprocessing
- ✅ Missing data handling
- ✅ Statistical correlation analysis
- ✅ Exploratory Data Analysis (EDA)
- ✅ Data visualization techniques

### Database Operations
- ✅ NoSQL database connectivity (MongoDB)
- ✅ CRUD operations
- ✅ Document-based data storage
- ✅ Query operations

### Data Visualization
- ✅ Matplotlib for plotting
- ✅ Seaborn for statistical graphics
- ✅ Correlation heatmaps
- ✅ Distribution plots

---

## 📈 Use Cases

- **E-commerce Analysis**: Price tracking and market research
- **Entertainment Industry**: Movie performance prediction
- **Cybersecurity**: Network traffic analysis and threat detection
- **News Aggregation**: Automated content collection
- **Data Science Portfolio**: Demonstrating end-to-end data projects

---

## 🛠️ Technologies Used

| Technology | Purpose |
|------------|---------|
| **Python** | Primary programming language |
| **Pandas** | Data manipulation and analysis |
| **NumPy** | Numerical computing |
| **BeautifulSoup4** | Web scraping and HTML parsing |
| **Requests** | HTTP library for API calls |
| **Matplotlib** | Data visualization |
| **Seaborn** | Statistical data visualization |
| **PyMongo** | MongoDB driver for Python |
| **Jupyter Notebook** | Interactive development environment |

---

## 📝 Project Structure

```
Data_analytics_and_webscrapping/
│
├── Automated Ebay Web Scrapping  Project.ipynb
├── Movies_Correlation_Project.ipynb
├── inroduction_to_mongo_db_data_analysis.ipynb
├── lab_one (1).ipynb
├── automatedScraping/
│   ├── autofoobal.ipynb
│   └── headline.csv
└── README.md
```

---

## 🎯 Learning Objectives

By exploring these projects, you'll learn:

1. **Web Scraping Best Practices**
   - Respectful scraping with proper headers
   - HTML structure navigation
   - Data extraction and transformation

2. **Statistical Analysis**
   - Correlation analysis
   - Data distribution understanding
   - Hypothesis testing fundamentals

3. **NoSQL Databases**
   - MongoDB document structure
   - CRUD operations
   - Query optimization

4. **Data Visualization**
   - Choosing appropriate chart types
   - Creating informative visualizations
   - Communicating insights effectively

---

## ⚠️ Important Notes

### Web Scraping Ethics
- Always check the website's `robots.txt` file
- Respect rate limits and server load
- Use appropriate user agents
- Only scrape publicly available data
- Comply with terms of service

### Data Privacy
- MongoDB examples use synthetic cybersecurity data
- No real user information is processed
- Safe for testing and learning purposes

---

## 🔧 Common Issues & Solutions

### Web Scraping Errors
**Issue**: `ConnectionError` or `Timeout`
**Solution**: Add delays between requests, check internet connection

**Issue**: HTML structure changes
**Solution**: Update CSS selectors or class names in scraping code

### MongoDB Connection Issues
**Issue**: `ServerSelectionTimeoutError`
**Solution**: Ensure MongoDB service is running
```bash
# Check MongoDB status
sudo systemctl status mongod
```

### Visualization Errors
**Issue**: Plots not displaying in Jupyter
**Solution**: Include `%matplotlib inline` at the beginning of notebook

---

## 📚 Additional Resources

- [BeautifulSoup Documentation](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)
- [Pandas Documentation](https://pandas.pydata.org/docs/)
- [MongoDB Python Tutorial](https://pymongo.readthedocs.io/)
- [Seaborn Gallery](https://seaborn.pydata.org/examples/index.html)
- [Web Scraping Best Practices](https://www.scrapingbee.com/blog/web-scraping-best-practices/)

---

## 🤝 Contributing

Feel free to:
- Fork the repository
- Add new scraping targets
- Improve data analysis techniques
- Enhance visualizations
- Share insights and findings

---

## 📄 License

These projects are for educational and portfolio purposes. Always respect website terms of service when web scraping.

---

**Built with Python for data extraction, analysis, and insights! 📊🔍**
