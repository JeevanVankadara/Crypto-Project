import mongoose from 'mongoose';
const { Schema } = mongoose;

export function createModels(connection) {
  const userSchema = new Schema(
    {
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true, select: false },
      role: { type: String, enum: ['student', 'faculty'], required: true },
      department: { type: String, required: true },
      studentId: { type: String, default: null },
    },
    { timestamps: true },
  );
  userSchema.index(
    { studentId: 1 },
    { unique: true, partialFilterExpression: { role: 'student' } },
  );

  const gradeSchema = new Schema(
    {
      fileId: { type: String, required: true, unique: true },
      studentId: { type: String, required: true, index: true },
      department: { type: String, required: true, index: true },
      semester: { type: String, required: true },
      title: { type: String, required: true },
      originalName: { type: String, required: true },
      sizeBytes: { type: Number, required: true },
      uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      demoKey: { type: String, unique: true, sparse: true },
    },
    { timestamps: true },
  );

  const auditSchema = new Schema(
    {
      actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      actorName: { type: String, required: true },
      department: { type: String, required: true },
      action: { type: String, enum: ['login', 'logout', 'upload', 'download'], required: true },
      outcome: { type: String, enum: ['allowed', 'denied', 'failed'], required: true },
      fileId: { type: String, default: null },
      detail: { type: String, required: true },
    },
    { timestamps: true },
  );
  auditSchema.index({ actorId: 1, createdAt: -1 });
  auditSchema.index({ department: 1, createdAt: -1 });

  return {
    User: connection.model('User', userSchema),
    GradeSheet: connection.model('GradeSheet', gradeSchema),
    AuditEvent: connection.model('AuditEvent', auditSchema),
  };
}
