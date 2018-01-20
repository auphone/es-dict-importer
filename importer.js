const Promise = require('bluebird');
const _ = require('lodash');
const es = require('elasticsearch');

const fs = Promise.promisifyAll(require('fs'));
const csv = Promise.promisifyAll(require('csv'));
const mappings = require('./assets/mapping.json');

// Easltcisearch host setup
const esClient = new es.Client({
  host: 'localhost:9200',
});

class Importer {
  constructor() {
    this.indices = ['freq_words', 'eng_dict'];
  }
  loadDataFiles() {
    return Promise.all([
      fs.readFileAsync('./assets/freq_words.csv'),
      fs.readFileAsync('./assets/cedict_ts.u8'),
    ]).then((data) => {
      const [freqWords, dictZh] = data;
      this.freqWords = freqWords;
      this.dictZh = dictZh;
      return Promise.resolve();
    });
  }
  static bulkInsert(data) {
    // Chunk the array to 100 for bulk insert
    const chunks = _.chunk(data, 100);
    return Promise.each(chunks, chunk => esClient.bulk({
      body: chunk,
    }));
  }
  transformFreq() {
    return csv.parseAsync(this.freqWords).then((csvArrs) => {
      // eslint-disable-next-line
      const [header, ...arrs] = csvArrs;
      const esData = [];
      arrs.forEach((arr) => {
        const [word, length, freqHal] = arr;
        esData.push({
          index: {
            _index: 'freq_words',
            _type: 'freq_words',
          },
        }, {
          word,
          length,
          freq_hal: freqHal,
        });
      });
      return Promise.resolve(esData);
    });
  }
  transformU8() {
    const lines = this.dictZh.toString().split('\n');
    const u8Objs = {};
    const esData = [];
    lines.forEach((line) => {
      if (!line.startsWith('#')) {
        const traditional = line.split(' ')[0];
        const engSplit = line.split('/');
        const engs = engSplit.slice(1, engSplit.length - 1);
        const engWords = engs.filter(eng => !eng.includes(' ') && !eng.includes('(') && !eng.includes('['));
        if (engWords.length > 0) {
          u8Objs[traditional] = u8Objs[traditional] || [];
          u8Objs[traditional] = _.concat(u8Objs[traditional], engWords);
        }
      }
    });
    _.forIn(u8Objs, (engs, trad) => {
      engs.forEach((eng) => {
        esData.push({
          index: {
            _index: 'eng_dict',
            _type: 'dict_zh',
          },
        }, {
          word: eng,
          translate: trad,
        });
      });
    });
    return Promise.resolve(esData);
  }
  insertMappings() {
    const tasks = [];
    this.indices.forEach((index) => {
      tasks.push(esClient.indices.create({
        index,
        body: mappings[index],
      }));
    });
    return Promise.all(tasks);
  }
  cleanIndices() {
    const tasks = [];
    this.indices.forEach((index) => {
      tasks.push(esClient.indices.delete({
        index,
      }));
    });
    return Promise
      .all(tasks)
      .catch(() => {})
      .finally(() => Promise.resolve());
  }
}

module.exports = Importer;
