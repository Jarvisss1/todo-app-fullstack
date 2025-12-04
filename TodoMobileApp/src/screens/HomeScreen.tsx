import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker'; // Added import
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { Task } from '../types';

// Updated Categories with "Others" and "General" to match default tags
const CATEGORIES = [
  'All',
  'Work',
  'Personal',
  'Study',
  'Health',
  'Others',
  'General',
];
const SORTS = ['Default', 'Smart Mix', 'Deadline', 'Priority'];
const TIME_FILTERS = [
  'Anytime',
  'Today',
  'This Week',
  'Overdue',
  'Custom Range',
];

const HomeScreen = ({ navigation }: any) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const { logout } = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Sort State
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('Default');

  // Advanced Time Filters
  const [timeFilter, setTimeFilter] = useState('Anytime');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [startDate, setStartDate] = useState(''); // Format: YYYY-MM-DD
  const [endDate, setEndDate] = useState(''); // Format: YYYY-MM-DD

  // Date Picker Visibility States
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data);
      checkUpcomingDeadlines(res.data);
    } catch (err: any) {
      console.error('Fetch Error:', err);
      if (err.response) {
        console.error('Server Response Data:', err.response.data);
        console.error('Server Status:', err.response.status);
      }
      Alert.alert('Error', 'Could not fetch tasks. Check console for details.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, []),
  );

  const checkUpcomingDeadlines = (currentTasks: Task[]) => {
    const now = Date.now();
    const oneDay = 86400000;

    const urgentTasks = currentTasks.filter(t => {
      if (!t.deadline || t.isCompleted) return false;
      const due = new Date(t.deadline).getTime();
      return due > now && due - now < oneDay;
    });

    if (urgentTasks.length > 0) {
      Alert.alert(
        '⚠️ Upcoming Deadlines',
        `You have ${urgentTasks.length} task(s) due within 24 hours! Check them out.`,
      );
    }
  };

  const toggleComplete = async (id: string, currentStatus: boolean) => {
    try {
      await api.put(`/tasks/${id}`, { isCompleted: !currentStatus });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await api.delete(`/tasks/${id}`);
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  // --- DATE PICKER HANDLERS ---
  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(false);
    if (selectedDate) {
      // Format to YYYY-MM-DD for consistency with filter logic
      const formatted = selectedDate.toISOString().split('T')[0];
      setStartDate(formatted);
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(false);
    if (selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0];
      setEndDate(formatted);
    }
  };

  // --- THE SMART SORTING & FILTERING ALGORITHM ---
  const getProcessedTasks = () => {
    let processed = [...tasks];

    // 1. CATEGORY FILTERING
    if (selectedCategory !== 'All') {
      processed = processed.filter(t => t.category === selectedCategory);
    }

    // 2. TIME FILTERING
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const nextWeek = todayStart + 7 * 86400000;

    if (timeFilter !== 'Anytime') {
      processed = processed.filter(t => {
        if (!t.deadline) return false;
        const due = new Date(t.deadline).getTime();

        switch (timeFilter) {
          case 'Today':
            return due >= todayStart && due < todayStart + 86400000;
          case 'This Week':
            return due >= todayStart && due < nextWeek;
          case 'Overdue':
            return due < Date.now() && !t.isCompleted;
          case 'Custom Range':
            const start = startDate
              ? new Date(startDate + 'T00:00:00').getTime()
              : 0;
            const end = endDate
              ? new Date(endDate + 'T23:59:59').getTime()
              : Infinity;
            return due >= start && due <= end;
          default:
            return true;
        }
      });
    }

    // 3. SORTING
    processed.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;

      switch (sortBy) {
        case 'Deadline':
          return (
            new Date(a.deadline || 0).getTime() -
            new Date(b.deadline || 0).getTime()
          );

        case 'Priority':
          const pMap: any = { High: 3, Medium: 2, Low: 1 };
          return pMap[b.priority] - pMap[a.priority];

        case 'Smart Mix':
          const getScore = (task: Task) => {
            let score = 0;
            const due = new Date(task.deadline || 0).getTime();
            const nowTime = Date.now();
            const oneDay = 86400000;

            if (task.priority === 'High') score += 50;
            if (task.priority === 'Medium') score += 30;
            if (task.priority === 'Low') score += 10;

            if (due < nowTime) score += 100;
            else if (due - nowTime < oneDay) score += 40;

            return score;
          };
          return getScore(b) - getScore(a);

        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

    return processed;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return '#e74c3c';
      case 'Medium':
        return '#f39c12';
      case 'Low':
        return '#2ecc71';
      default:
        return '#95a5a6';
    }
  };

  const renderItem = ({ item }: { item: Task }) => (
    <View style={[styles.card, item.isCompleted && styles.completedCard]}>
      <View style={styles.cardHeader}>
        <View>
          <Text
            style={[styles.taskTitle, item.isCompleted && styles.completedText]}
          >
            {item.title}
          </Text>
          <Text style={styles.categoryTag}>{item.category || 'General'}</Text>
        </View>
        <View
          style={[
            styles.badge,
            { backgroundColor: getPriorityColor(item.priority) },
          ]}
        >
          <Text style={styles.badgeText}>{item.priority}</Text>
        </View>
      </View>

      {item.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      {item.deadline ? (
        <Text
          style={[
            styles.date,
            new Date(item.deadline) < new Date() &&
              !item.isCompleted && { color: 'red', fontWeight: 'bold' },
          ]}
        >
          {new Date(item.deadline) < new Date() && !item.isCompleted
            ? '⚠️ Overdue: '
            : '📅 '}
          {new Date(item.deadline).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => toggleComplete(item._id, item.isCompleted)}
        >
          <Text style={styles.actionText}>
            {item.isCompleted ? 'Undo' : 'Complete'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteTask(item._id)}>
          <Text style={[styles.actionText, { color: 'red' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tasks</Text>
        <View style={{ flexDirection: 'row', gap: 15 }}>
          <TouchableOpacity onPress={() => setShowFilterModal(true)}>
            <Text style={styles.filterBtnText}>
              Filters {timeFilter !== 'Anytime' ? '•' : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollFilters}
        >
          <Text style={styles.filterLabel}>Sort:</Text>
          {SORTS.map(sort => (
            <TouchableOpacity
              key={sort}
              onPress={() => setSortBy(sort)}
              style={[
                styles.filterChip,
                sortBy === sort && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  sortBy === sort && styles.filterTextActive,
                ]}
              >
                {sort}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.divider} />
          <Text style={styles.filterLabel}>Cat:</Text>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.filterChip,
                selectedCategory === cat && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedCategory === cat && styles.filterTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {timeFilter !== 'Anytime' && (
          <View style={styles.activeFilterBar}>
            <Text style={styles.activeFilterText}>
              Active: {timeFilter}{' '}
              {timeFilter === 'Custom Range'
                ? `(${startDate} - ${endDate})`
                : ''}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setTimeFilter('Anytime');
                setStartDate('');
                setEndDate('');
              }}
            >
              <Text style={styles.clearFilterText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={getProcessedTasks()}
        renderItem={renderItem}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchTasks} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No tasks found matching criteria.
          </Text>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddTask')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ADVANCED FILTER MODAL */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Time</Text>

            <View style={styles.modalChipContainer}>
              {TIME_FILTERS.map(tf => (
                <TouchableOpacity
                  key={tf}
                  style={[
                    styles.modalChip,
                    timeFilter === tf && styles.modalChipActive,
                  ]}
                  onPress={() => setTimeFilter(tf)}
                >
                  <Text
                    style={[
                      styles.modalChipText,
                      timeFilter === tf && styles.modalChipTextActive,
                    ]}
                  >
                    {tf}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {timeFilter === 'Custom Range' && (
              <View style={styles.dateInputContainer}>
                <Text style={styles.inputLabel}>Date Range</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {/* START DATE PICKER */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 10, color: '#666', marginBottom: 2 }}
                    >
                      Start Date
                    </Text>
                    <TouchableOpacity
                      style={styles.datePickerBtn}
                      onPress={() => setShowStartPicker(true)}
                    >
                      <Text style={styles.datePickerText}>
                        {startDate || 'Select Date'}
                      </Text>
                    </TouchableOpacity>
                    {showStartPicker && (
                      <DateTimePicker
                        value={startDate ? new Date(startDate) : new Date()}
                        mode="date"
                        display="default"
                        onChange={onStartDateChange}
                      />
                    )}
                  </View>

                  {/* END DATE PICKER */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontSize: 10, color: '#666', marginBottom: 2 }}
                    >
                      End Date
                    </Text>
                    <TouchableOpacity
                      style={styles.datePickerBtn}
                      onPress={() => setShowEndPicker(true)}
                    >
                      <Text style={styles.datePickerText}>
                        {endDate || 'Select Date'}
                      </Text>
                    </TouchableOpacity>
                    {showEndPicker && (
                      <DateTimePicker
                        value={endDate ? new Date(endDate) : new Date()}
                        mode="date"
                        display="default"
                        onChange={onEndDateChange}
                      />
                    )}
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={styles.closeBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  filterBtnText: { color: '#4a90e2', fontWeight: '600', fontSize: 16 },
  logoutText: { color: 'red', fontWeight: '600' },

  filterContainer: {
    backgroundColor: '#fff',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  scrollFilters: { paddingHorizontal: 15 },
  filterLabel: {
    marginRight: 10,
    marginTop: 8,
    fontWeight: 'bold',
    color: '#888',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f0f2f5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: { backgroundColor: '#e6f0ff', borderColor: '#4a90e2' },
  filterText: { color: '#666', fontSize: 12 },
  filterTextActive: { color: '#4a90e2', fontWeight: 'bold' },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#ddd',
    marginHorizontal: 10,
    alignSelf: 'center',
  },

  activeFilterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  activeFilterText: { color: '#4a90e2', fontSize: 12, fontWeight: '600' },
  clearFilterText: { color: 'red', fontSize: 12 },

  list: { padding: 20, paddingBottom: 80 },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  completedCard: { opacity: 0.6, backgroundColor: '#f9f9f9' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  taskTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  categoryTag: {
    fontSize: 10,
    color: '#888',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  completedText: { textDecorationLine: 'line-through', color: '#aaa' },
  description: { color: '#666', marginBottom: 8, fontSize: 14 },
  date: { color: '#888', fontSize: 12, marginBottom: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 15,
    marginTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  actionText: { color: '#4a90e2', fontWeight: 'bold', fontSize: 14 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 30, marginTop: -2 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#888' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  modalChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f2f5',
  },
  modalChipActive: { backgroundColor: '#4a90e2' },
  modalChipText: { color: '#666' },
  modalChipTextActive: { color: '#fff', fontWeight: 'bold' },
  dateInputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 12, color: '#888', marginBottom: 5, marginLeft: 5 },

  // New Styles for Date Picker Buttons
  datePickerBtn: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  datePickerText: { color: '#333', fontSize: 14 },

  closeBtn: {
    backgroundColor: '#4a90e2',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default HomeScreen;
