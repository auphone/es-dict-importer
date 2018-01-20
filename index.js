const Promise = require('bluebird');
const _ = require('lodash');
const fs = require('fs');
const es = require('elasticsearch');
const mappings = require('./assets/mapping.json');

const csv = Promise.promisifyAll(require('csv'));

const freqWords = fs.readFileSync('./assets/freq_words.csv');
const distZh = fs.readFileSync('./assets/cedict_ts.u8');

// Easltcisearch host setup
const esClient = new es.Client({
  host: 'localhost:9200',
});
const indices = [ 'freq_words', 'eng_dict' ];

const run = () => {
  // Delete indices for clean install 
  cleanIndices().then(() => {
    // Insert mappings and parse dict files
    return Promise.all([
      insertMappings(),
      transformFreq(freqWords),
      transformU8(distZh),
    ]);
  }).then((results) => {
    const [insertRes, freqData, u8Data] = results;
    // Bulk insert data
    return Promise.all([
      bulkInsert(freqData),
      bulkInsert(u8Data),
    ]);
  }).then(() => {
    console.log('Done!');
  }).catch((err) => {
    console.error(err);
  });
}

const bulkInsert = (data) => {
  // Chunk the array to 100 for bulk insert
  const chunks = _.chunk(data, 100);
  return Promise.each(chunks, (chunk) => {
    return esClient.bulk({
      body: chunk
    });
  });
}

const transformFreq = (data) => {
  return csv.parseAsync(data).then((csvArrs) => {
    const [ header, ...arrs ] = csvArrs;
    const esData = [];
    arrs.forEach((arr) => {
      const [ word, length, freq_hal ] = arr;
      esData.push({
        index: {
          _index: 'freq_words',
          _type: 'freq_words',
        }
      }, {
        word,
        length,
        freq_hal,
      });
    });
    return Promise.resolve(esData);
  });
}

const transformU8 = (data) => {
  const lines = data.toString().split('\n');
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
        }
      }, {
        word: eng,
        translate: trad,
      });
    });
  });
  return Promise.resolve(esData);
};

insertMappings = () => {
  let tasks = [];
  indices.forEach((index) => {
    tasks.push(esClient.indices.create({
      index: index,
      body: mappings[index],
    }));
  });
  return Promise.all(tasks);
}

cleanIndices = () => {
  let tasks = [];
  indices.forEach((index) => {
    tasks.push(esClient.indices.delete({
      index: index,
    }));
  });
  return Promise
    .all(tasks)
    .catch(() => {})
    .finally(() => Promise.resolve());
}


// Run at the end
run();