// Attributes come from the saved user record, never from a request body.
export function canReadGradeSheet(user, sheet) {
  if (user.role === 'student') return user.studentId === sheet.studentId;
  return user.role === 'faculty' && user.department === sheet.department;
}

export function visibleGradeQuery(user) {
  return user.role === 'faculty' ? { department: user.department } : { studentId: user.studentId };
}

export function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    studentId: user.studentId,
  };
}
