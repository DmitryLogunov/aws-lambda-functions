const { handler } = require('../dist/src/index');
const setenv = require('setenv');
const yaml = require('js-yaml');
const fs = require('fs');
const randomstring = require("randomstring");
const faker = require('faker');

const { DBClient } = require('../dist/src/core/lib/db-client');
const SyncManager = require('../dist/src/lib/sync-manager').default;

const pathToConfigfile = `${process.cwd()}/config.tests.yaml`;

if (!fs.existsSync(pathToConfigfile)) {
  console.error('Error: There is no Config file! The tests can not be run so it will be terminated.');
  process.exit(1);
}

const configData = fs.readFileSync(pathToConfigfile, 'utf8');
global.config = yaml.safeLoad(configData);

setenv.set('DB_HOST', global.config.host);
setenv.set('DB_USER', global.config.user);
setenv.set('DB_PASSWORD', global.config.password);

const dbSettings = {
  connectionLimit: 10,
  host: global.config.host,    
  password: global.config.password,
  port: 3306,   
  user: global.config.user
}
global.dbClient = new DBClient(dbSettings);

const syncManager = new SyncManager();

jest.setTimeout(30000);

let newCustomerID;

/***************************/
test('Test of the main handler => INSERT', async done => { 
  const data = {uid: faker.random.number(), pod: 2, name: 'aaaaaa', status: 2, editor: 0, last_modified: '2020-02-27 08:34:22',
  last_synced: '2019-09-24 00:00:00', major: 0, email: `email@${randomstring.generate()}`, mobile: '+7 921 1234567', retry: 0, is_test: 0, mailbox_id: faker.random.number()};
  
  const newCustomerSQL = `
    INSERT INTO \`impdb\`.\`customer\`
    ( \`uid\`, \`pod\`,  \`name\`, \`status\`, \`editor\`, \`last_modified\`, \`last_synced\`, \`major\`, \`email\`,
    \`mobile\`, \`retry\`, \`is_test\`, \`mailbox_id\`)
    VALUES ( '${data.uid}', '${data.pod}', '${data.name}', ${data.status}, ${data.editor}, '${data.last_modified}',
    '${data.last_synced}', ${data.major}, '${data.email}', '${data.mobile}', ${data.retry}, ${data.is_test}, '${data.mailbox_id}')`;

  const dbResult = await global.dbClient.query(newCustomerSQL);  
  const dbResultNewCustomer = dbResult.data;
  newCustomerID =  dbResultNewCustomer.insertId;

  expect(dbResult.status).toBeTruthy();
  expect(newCustomerID).not.toBeNull(); 
  data.id = newCustomerID;
  const customerData = JSON.stringify(data);

  const event = {
    Action: "insert",
    Data: customerData
  }; 

  const response = await handler(event);

  expect(response.statusCode).toBe(200);

  const newAccountSQL = `SELECT * FROM \`rcsredb\`.\`accounts\` AS a WHERE a.\`source_id\` = '${newCustomerID}' AND a.\`source_table\` = 'impdb.customer'`;
  const newAccountData = (await global.dbClient.query(newAccountSQL)).data.shift();
  
  expect(newAccountData).not.toBeUndefined();

  expect(syncManager.isEqual(data, newAccountData)).toBeTruthy();

  data.name = randomstring.generate();
  expect(syncManager.isEqual(data, newAccountData)).toBeFalsy();

  done();
});

/***************************/
test('Test of the main handler => UPDATE', async done => { 
  const data = {uid: faker.random.number(), pod: 2, name: 'aaaaaa', status: 2, editor: 0, last_modified: '2020-02-27 08:34:22',
  last_synced: '2019-09-24 00:00:00', major: 0, email: `email@${randomstring.generate()}`, mobile: `+7 921 ${faker.random.number()}`, retry: 0, is_test: 0, mailbox_id: faker.random.number()};
  
  const newCustomerSQL = `
    UPDATE \`impdb\`.\`customer\`
    SET \`uid\` = '${data.uid}', \`pod\` = '${data.pod}',  \`name\` = '${data.name}', \`status\` = ${data.status}, 
    \`editor\` =  ${data.editor}, \`last_modified\` = '${data.last_modified}', \`last_synced\` = '${data.last_synced}', 
    \`major\` = ${data.major}, \`email\` = '${data.email}',\`mobile\` = '${data.mobile}', \`retry\` = ${data.retry}, 
    \`is_test\` = ${data.is_test}, \`mailbox_id\` = '${data.mailbox_id}'
    WHERE id = '${newCustomerID}'`;

  const dbResult = await global.dbClient.query(newCustomerSQL);  
  expect(dbResult.status).toBeTruthy();
  
  data.id = newCustomerID;
  const customerData = JSON.stringify(data);

  const event = {
    Action: "update",
    Data: customerData
  }; 

  const response = await handler(event); 
  
  expect(response.statusCode).toBe(200);

  const newAccountSQL = `SELECT * FROM \`rcsredb\`.\`accounts\` AS a WHERE a.\`source_id\` = '${newCustomerID}' AND a.\`source_table\` = 'impdb.customer'`;
  const newAccountData = (await global.dbClient.query(newAccountSQL)).data.shift();
  
  expect(newAccountData).not.toBeUndefined();

  expect(syncManager.isEqual(data, newAccountData)).toBeTruthy();

  data.name = randomstring.generate();
  expect(syncManager.isEqual(data, newAccountData)).toBeFalsy();

  done();
});

/***************************/
test('Test of the main handler => check error UPDATE in transaction', async done => { 
  let accountSQL = `SELECT * FROM \`rcsredb\`.\`accounts\` AS a WHERE a.\`source_id\` = '${newCustomerID}' AND a.\`source_table\` = 'impdb.customer'`;
  let accountData = (await global.dbClient.query(accountSQL)).data.shift();  
  expect(accountData).not.toBeUndefined();
  const originalAccountTitle = accountData.title;

  const selectCustomerSQL = `SELECT * FROM \`impdb\`.\`customer\` AS c WHERE c.\`id\` = '${newCustomerID}'`;  
  const customerData = (await global.dbClient.query(selectCustomerSQL)).data.shift();
  expect(customerData).not.toBeUndefined();

 
  const data = customerData;    
  data.id = newCustomerID;
   /* too long customer name => MySQL fails it with exception */
  data.name = `sdasdjewodjedewdeqwdjeqwdioqwdjqwiodioqwsdasdjewodjedewd
               eqwdjeqwdioqwdjqwiodioqwsdasdjewodjedewdeqwdjeqwdioqwdjqwiod
               ioqwsdasdjewodjedewdeqwdjeqwdioqwdjqwiodioqwsdasdjewodjedewde
               qwdjeqwdioqwdjqwiodioqwsdasdjewodjedewdeqwdjeqwdioqwdjqwiodio
               qwsdasdjewodjedewdeqwdjeqwdioqwdjqwiodioqwsdasdjewodjedewdeqwd
               jeqwdioqwdjqwiodioqwsdasdjewodjedewdeqwdjeqwdioqwdjqwiodioqwsdas
               djewodjedewdeqwdjeqwdioqwdjqwiodioqwsdasdjewodjedewdeqwdjeqwdioqw
               djqwiodioqwsdasdjewodjedewdeqwdjeqwdioqwdjqwiodioqwsdasdjewodjedewdeq
               wdjeqwdioqwdjqwiodioqwsdasdjewodjedewdeqwdjeqwdioqwdjqwiodioqwsdasdjew
               odjedewdeqwdjeqwdioqwdjqwiodioqw`; 

  const event = {
    Action: "update",
    Data: JSON.stringify(data)
  }; 

  const response = await handler(event); 
  
  expect(response.statusCode).toBe(400);

  accountSQL = `SELECT * FROM \`rcsredb\`.\`accounts\` AS a WHERE a.\`source_id\` = '${newCustomerID}' AND a.\`source_table\` = 'impdb.customer'`;
  accountData = (await global.dbClient.query(accountSQL)).data.shift();
  
  expect(accountData.title).toBe(originalAccountTitle); 

  done();
});

/***************************/
test('Test of the main handler => DELETE', async done => { 
  let accountSQL = `SELECT * FROM \`rcsredb\`.\`accounts\` AS a WHERE a.\`source_id\` = '${newCustomerID}' AND a.\`source_table\` = 'impdb.customer'`;
  let accountData = (await global.dbClient.query(accountSQL)).data.shift();  
  expect(accountData).not.toBeUndefined();

  const selectCustomerSQL = `SELECT * FROM \`impdb\`.\`customer\` AS c WHERE c.\`id\` = '${newCustomerID}'`;  
  const customerData = (await global.dbClient.query(selectCustomerSQL)).data.shift();
  expect(customerData).not.toBeUndefined();

  const deleteCustomerSQL = `DELETE FROM \`impdb\`.\`customer\`  WHERE id = '${newCustomerID}'`;
  const dbResult = await global.dbClient.query(deleteCustomerSQL);  
  expect(dbResult.status).toBeTruthy();

  const event = {
    Action: "delete",
    Data: JSON.stringify(customerData)
  }; 

  const response = await handler(event);
  expect(response.statusCode).toBe(200);

  accountSQL = `SELECT * FROM \`rcsredb\`.\`accounts\` AS a WHERE a.\`source_id\` = '${newCustomerID}' AND a.\`source_table\` = 'impdb.customer'`;
  accountData = (await global.dbClient.query(accountSQL)).data.shift();  
  expect(accountData).toBeUndefined();

  done();
});
