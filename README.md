# es-dict-importer
A Elasticsearch importer for English to Chinese dictionary

## Getting Started

**Important!** This script will remove these Elasticsearch indices

* freq_words
* eng_dict

### Prerequisites
* [Node.js](https://nodejs.org) >= 8.x
* [Elasticsearch](https://www.elastic.co/products/elasticsearch) >= 5.x

### Installing
```bash
git clone https://github.com/auphone/es-dict-importer.git
cd es-dict-importer
npm install
```

### Run
```bash
node index.js
```
