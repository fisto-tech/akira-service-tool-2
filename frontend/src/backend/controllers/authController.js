import Employee from '../models/Employee.js';
import { generateToken } from '../middleware/auth.js';

export const registerEmployee = async (req, res) => {
  try {
    const {
      fullName,
      empId,
      email,
      password,
      phoneNumber,
      dateOfBirth,
      gender,
      role,
      department,
      designation,
      dateOfJoining,
      workingStatus,
      profilePicture
    } = req.body;

    const existingEmployee = await Employee.findOne({ $or: [{ empId }, { email }] });

    if (existingEmployee) {
      const field = existingEmployee.empId === empId ? 'Employee ID' : 'Email';
      return res.status(400).json({ message: `${field} already exists` });
    }

    const employee = await Employee.create({
      fullName,
      empId,
      email,
      password,
      phoneNumber,
      dateOfBirth,
      gender,
      role,
      department,
      designation,
      dateOfJoining,
      workingStatus: workingStatus || 'Active',
      profilePicture
    });

    const token = generateToken(employee._id);

    res.status(201).json({
      success: true,
      message: 'Employee registered successfully',
      data: {
        employee: {
          _id: employee._id,
          fullName: employee.fullName,
          empId: employee.empId,
          email: employee.email,
          phoneNumber: employee.phoneNumber,
          dateOfBirth: employee.dateOfBirth,
          gender: employee.gender,
          role: employee.role,
          department: employee.department,
          designation: employee.designation,
          dateOfJoining: employee.dateOfJoining,
          workingStatus: employee.workingStatus,
          profilePicture: employee.profilePicture
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
};

export const loginEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const employee = await Employee.findOne({ email });

    if (!employee) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await employee.matchPassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (employee.workingStatus !== 'Active') {
      return res.status(403).json({ message: 'Account is not active. Please contact administrator.' });
    }

    const token = generateToken(employee._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        employee: {
          _id: employee._id,
          fullName: employee.fullName,
          empId: employee.empId,
          email: employee.email,
          phoneNumber: employee.phoneNumber,
          dateOfBirth: employee.dateOfBirth,
          gender: employee.gender,
          role: employee.role,
          department: employee.department,
          designation: employee.designation,
          dateOfJoining: employee.dateOfJoining,
          workingStatus: employee.workingStatus,
          profilePicture: employee.profilePicture
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
};

export const getCurrentEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.employee._id).select('-password');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      success: true,
      data: { employee }
    });
  } catch (error) {
    console.error('Get current employee error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
