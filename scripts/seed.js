import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readConfig } from '../src/config.js';
import { connectDatabase } from '../src/db.js';
import { loadSecrets } from '../src/security/secrets.js';
import { hashPassword } from '../src/security/passwords.js';
import { saveGradeSheet } from '../src/services/grade-sheets.js';
import { DEMO_USERS, DEMO_PASSWORD, makeSamplePdf } from './demo-data.js';

let connection;
try {
  const config = readConfig();
  const database = await connectDatabase(config);
  connection = database.connection;
  const { models } = database;
  const secrets = await loadSecrets(config, models);
  await mkdir(config.sampleDir, { recursive: true });
  for (const user of DEMO_USERS) {
    if (!(await models.User.exists({ email: user.email }))) {
      await models.User.create({ ...user, passwordHash: await hashPassword(DEMO_PASSWORD) });
    }
  }
  const faculty = await models.User.findOne({ email: DEMO_USERS[0].email });
  for (const student of DEMO_USERS.filter((user) => user.role === 'student')) {
    const buffer = await makeSamplePdf(student);
    const originalName = `${student.studentId}-semester-5.pdf`;
    await writeFile(path.join(config.sampleDir, originalName), buffer);
    const demoKey = `seed-${student.studentId}-semester-5`;
    if (!(await models.GradeSheet.exists({ demoKey }))) {
      await saveGradeSheet(
        { config, models, secrets },
        {
          buffer,
          studentId: student.studentId,
          department: student.department,
          semester: '5',
          title: 'Semester 5 grade sheet',
          originalName,
          uploadedBy: faculty._id,
          demoKey,
        },
      );
    }
  }
  console.log('Demo data is ready. Existing accounts and uploaded records were preserved.');
  console.table(
    DEMO_USERS.map(({ name, email, role, department }) => ({ name, email, role, department })),
  );
  console.log(`Shared DEMO password: ${DEMO_PASSWORD}`);
  console.log(`Fake PDFs for testing uploads: ${config.sampleDir}`);
  console.log(`Encrypted files: ${config.storageDir}`);
} catch (error) {
  console.error(`Seed failed: ${error.message}`);
  console.error('Make sure local MongoDB is running: npm run db:start');
  process.exitCode = 1;
} finally {
  if (connection) await connection.close();
}
