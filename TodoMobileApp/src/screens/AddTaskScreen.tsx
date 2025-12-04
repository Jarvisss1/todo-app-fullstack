import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../services/api';

const CATEGORIES = ['Work', 'Personal', 'Study', 'Health', 'General'];

const AddTaskScreen = ({ navigation }: any) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [category, setCategory] = useState('General');

  // Date Picker State
  const [deadline, setDeadline] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleAddTask = async () => {
    if (!title) return Alert.alert('Error', 'Title is required');

    try {
      await api.post('/tasks', {
        title,
        description,
        priority,
        category,
        deadline: deadline.toISOString(),
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to add task');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      // Create a new Date object to avoid mutating the original reference
      const dateOnly = new Date(selectedDate);
      // STRIP THE TIME: Set hours, minutes, seconds, ms to 0
      dateOnly.setHours(0, 0, 0, 0);
      setDeadline(dateOnly);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>New Task</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="What needs to be done?"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Add details..."
        multiline
      />

      {/* Categories */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.chipContainer}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipSelected]}
            onPress={() => setCategory(cat)}
          >
            <Text
              style={[
                styles.chipText,
                category === cat && styles.chipTextSelected,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Priority */}
      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipContainer}>
        {['Low', 'Medium', 'High'].map(p => (
          <TouchableOpacity
            key={p}
            style={[
              styles.chip,
              priority === p && {
                backgroundColor:
                  p === 'High'
                    ? '#e74c3c'
                    : p === 'Medium'
                    ? '#f39c12'
                    : '#2ecc71',
                borderColor: 'transparent',
              },
            ]}
            onPress={() => setPriority(p)}
          >
            <Text
              style={[styles.chipText, priority === p && { color: '#fff' }]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Picker */}
      <Text style={styles.label}>Deadline</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={styles.dateText}>📅 {deadline.toLocaleDateString()}</Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={deadline}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

      <TouchableOpacity style={styles.saveButton} onPress={handleAddTask}>
        <Text style={styles.saveButtonText}>Save Task</Text>
      </TouchableOpacity>
      <View style={{ height: 50 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },

  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#4a90e2', borderColor: '#4a90e2' },
  chipText: { color: '#555', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },

  dateButton: {
    padding: 15,
    backgroundColor: '#f0f2f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  dateText: { fontSize: 16, color: '#333' },

  saveButton: {
    backgroundColor: '#4a90e2',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30,
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});

export default AddTaskScreen;
