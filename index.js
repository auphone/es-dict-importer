const Importer = require('./importer');

const importer = new Importer();

importer.cleanIndices()
  .then(() => importer.loadDataFiles()).then(() => Promise.all([
    importer.insertMappings(),
    importer.transformFreq(),
    importer.transformU8(),
  ])).then((results) => {
    // eslint-disable-next-line
    const [insertStatus, freqData, u8Data] = results;
    // Bulk insert data
    return Promise.all([
      Importer.bulkInsert(freqData),
      Importer.bulkInsert(u8Data),
    ]);
  })
  .then(() => {
    console.log('Done!');
  })
  .catch((err) => {
    console.error(err);
  });
