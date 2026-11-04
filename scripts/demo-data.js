import PDFDocument from 'pdfkit';

export const DEMO_PASSWORD = 'DemoGrades!2026';
export const DEMO_USERS = [
  {
    name: 'Dr. Maya Rao',
    email: 'faculty.cse@demo.local',
    role: 'faculty',
    department: 'CSE',
    studentId: null,
  },
  {
    name: 'Aarav Sharma',
    email: 'student.a@demo.local',
    role: 'student',
    department: 'CSE',
    studentId: '23CS101',
  },
  {
    name: 'Meera Nair',
    email: 'student.b@demo.local',
    role: 'student',
    department: 'CSE',
    studentId: '23CS102',
  },
  {
    name: 'Dr. Arun Das',
    email: 'faculty.ece@demo.local',
    role: 'faculty',
    department: 'ECE',
    studentId: null,
  },
];

export function makeSamplePdf(student, semester = '5') {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: { Title: 'Synthetic grade sheet', Author: 'Academic Vault demo' },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.rect(0, 0, 595, 140).fill('#142b43');
    doc.fillColor('#94ddd0').fontSize(11).text('ACADEMIC VAULT / DEMONSTRATION', 48, 40);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(28)
      .text('Semester grade sheet', 48, 70);
    doc
      .fillColor('#d6e1ec')
      .font('Helvetica')
      .fontSize(11)
      .text('Synthetic record - not an official academic document', 48, 108);
    doc.fillColor('#142b43').fontSize(12).text(`Student: ${student.name}`, 48, 175);
    doc.text(`Student ID: ${student.studentId}`, 48, 198);
    doc.text(`Department: ${student.department}   |   Semester: ${semester}`, 48, 221);
    doc.rect(48, 270, 499, 30).fill('#e9eff4');
    doc
      .fillColor('#142b43')
      .font('Helvetica-Bold')
      .text('Course', 60, 280)
      .text('Credits', 380, 280)
      .text('Grade', 460, 280);
    const courses = [
      ['Cryptography and Network Security', '4', 'A'],
      ['Database Management Systems', '4', 'A+'],
      ['Software Engineering', '3', 'A'],
      ['Computer Networks Laboratory', '2', 'A+'],
    ];
    courses.forEach(([course, credits, grade], index) => {
      const y = 320 + index * 42;
      doc.font('Helvetica').text(course, 60, y).text(credits, 395, y).text(grade, 473, y);
      doc
        .moveTo(48, y + 25)
        .lineTo(547, y + 25)
        .strokeColor('#dbe3e9')
        .stroke();
    });
    doc
      .fontSize(10)
      .fillColor('#586a7a')
      .text('All names, identifiers, and grades in this document are fictional.', 48, 530);
    doc.text('Project: Secure Academic Data Sharing Using Attribute-Based Encryption', 48, 550);
    doc.text('Current implementation: phases 1 and 2, server-controlled baseline.', 48, 570);
    doc.end();
  });
}
