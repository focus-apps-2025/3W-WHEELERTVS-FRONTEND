import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  UserPlus, 
  Users, 
  Clock, 
  Calendar,
  X,
  Check,
  AlertCircle,
  Loader2,
  Trash
} from 'lucide-react';

interface Shift {
  _id: string;
  name: string;
  displayName: string;
  startTime: string;
  endTime: string;
  gracePeriod: number;
  lateMarkingAfter: number;
  halfDayMarkingAfter: number;
  assignedInspectors: any[];
  isNightShift: boolean;
}

interface Inspector {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
}

export default function ShiftManagement() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [unassignedInspectors, setUnassignedInspectors] = useState<Inspector[] | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedShiftForAssign, setSelectedShiftForAssign] = useState<Shift | null>(null);
  const [selectedInspectorIds, setSelectedInspectorIds] = useState<string[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    startTime: '09:00',
    endTime: '18:00',
    gracePeriod: 15,
    lateMarkingAfter: 30,
    halfDayMarkingAfter: 120,
    isNightShift: false
  });

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getShifts();
      console.log('Shifts response:', response);
      if (response && response.data) {
        console.log('Shifts data:', response.data);
        setShifts(response.data);
      } else if (response) {
        console.log('Shifts raw:', response);
        setShifts(response);
      }
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedInspectors = async () => {
    try {
      const response = await apiClient.getAvailableInspectors();
      console.log('Available inspectors response:', response);
      if (response && response.data) {
        setUnassignedInspectors(response.data);
      } else if (response) {
        setUnassignedInspectors(response);
      }
    } catch (error) {
      console.error('Error fetching inspectors:', error);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingShift) {
        await apiClient.updateShift(editingShift._id, formData);
      } else {
        await apiClient.createShift(formData);
      }
      setShowModal(false);
      setEditingShift(null);
      resetForm();
      fetchShifts();
    } catch (error: any) {
      alert(error.message || 'Action failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this shift?')) return;
    try {
      await apiClient.deleteShift(id);
      fetchShifts();
    } catch (error: any) {
      alert(error.message || 'Delete failed');
    }
  };

  const handleAssignInspectors = async () => {
    if (!selectedShiftForAssign || selectedInspectorIds.length === 0) return;
    try {
      await apiClient.assignInspectorsToShift(selectedShiftForAssign._id, selectedInspectorIds);
      setShowAssignModal(false);
      setSelectedInspectorIds([]);
      fetchShifts();
    } catch (error: any) {
      alert(error.message || 'Assignment failed');
    }
  };

  const handleRemoveInspector = async (shiftId: string, inspectorId: string) => {
    if (!window.confirm('Remove this inspector from shift?')) return;
    try {
      await apiClient.removeInspectorsFromShift(shiftId, [inspectorId]);
      fetchShifts();
    } catch (error: any) {
      alert(error.message || 'Removal failed');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      startTime: '09:00',
      endTime: '18:00',
      gracePeriod: 15,
      lateMarkingAfter: 30,
      halfDayMarkingAfter: 120,
      isNightShift: false
    });
  };

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      displayName: shift.displayName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      gracePeriod: shift.gracePeriod,
      lateMarkingAfter: shift.lateMarkingAfter,
      halfDayMarkingAfter: shift.halfDayMarkingAfter,
      isNightShift: shift.isNightShift
    });
    setShowModal(true);
  };

  const openAssignModal = async (shift: Shift) => {
    setSelectedShiftForAssign(shift);
    setUnassignedInspectors(null);
    setAssignLoading(true);
    setShowAssignModal(true);
    await fetchUnassignedInspectors();
    setAssignLoading(false);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shift Management</h1>
            <p className="text-gray-600">Define office hours and assign inspectors to shifts</p>
          </div>
          <button
            onClick={() => { resetForm(); setEditingShift(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Create Shift
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-blue-600" size={40} />
          </div>
        ) : shifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <Calendar size={48} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700">No Shifts Found</h3>
            <p className="text-gray-500 text-sm mt-1">Create your first shift to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shifts?.map(shift => (
              <div key={shift._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{shift.displayName}</h3>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{shift.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(shift)} className="p-1.5 text-gray-400 hover:text-blue-600 transition">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(shift._id)} className="p-1.5 text-gray-400 hover:text-red-600 transition">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-4 text-gray-700">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-500" />
                      <span className="font-semibold">{shift.startTime} - {shift.endTime}</span>
                    </div>
                    {shift.isNightShift && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">Night</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-green-50 p-2 rounded">
                      <div className="text-green-600 font-bold">{shift.gracePeriod}m</div>
                      <div className="text-gray-500">Grace</div>
                    </div>
                    <div className="bg-yellow-50 p-2 rounded">
                      <div className="text-yellow-600 font-bold">{shift.lateMarkingAfter}m</div>
                      <div className="text-gray-500">Late</div>
                    </div>
                    <div className="bg-orange-50 p-2 rounded">
                      <div className="text-orange-600 font-bold">{shift.halfDayMarkingAfter}m</div>
                      <div className="text-gray-500">Half-Day</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Users size={16} className="text-gray-400" />
                        Inspectors ({shift.assignedInspectors.length})
                      </span>
                      <button 
                        onClick={() => openAssignModal(shift)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1"
                      >
                        <UserPlus size={14} />
                        Assign
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2">
                      {shift?.assignedInspectors?.map((ins: any) => (
                        <div key={ins._id} className="flex items-center bg-gray-100 px-2 py-1 rounded text-xs text-gray-700 group">
                          {ins.firstName} {ins.lastName}
                          <button 
                            onClick={() => handleRemoveInspector(shift._id, ins._id)}
                            className="ml-1.5 text-gray-400 hover:text-red-500 hidden group-hover:block"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">{editingShift ? 'Edit Shift' : 'Create New Shift'}</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreateOrUpdate} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">System Name</label>
                    <input
                      required
                      placeholder="e.g., morning-shift"
                      className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Display Name</label>
                    <input
                      required
                      placeholder="e.g., Morning Shift"
                      className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.displayName}
                      onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.startTime}
                      onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      required
                      className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.endTime}
                      onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Grace Period</label>
                    <input
                      type="number"
                      className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.gracePeriod}
                      onChange={e => setFormData({ ...formData, gracePeriod: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Late After</label>
                    <input
                      type="number"
                      className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.lateMarkingAfter}
                      onChange={e => setFormData({ ...formData, lateMarkingAfter: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Half-Day After</label>
                    <input
                      type="number"
                      className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.halfDayMarkingAfter}
                      onChange={e => setFormData({ ...formData, halfDayMarkingAfter: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="nightShift"
                    className="w-5 h-5 accent-blue-600 rounded"
                    checked={formData.isNightShift}
                    onChange={e => setFormData({ ...formData, isNightShift: e.target.checked })}
                  />
                  <label htmlFor="nightShift" className="text-sm font-bold text-gray-700 cursor-pointer">Night Shift (Crosses midnight)</label>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition"
                  >
                    {editingShift ? 'Save Changes' : 'Create Shift'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">Assign Inspectors</h2>
                <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">Select inspectors to assign to <strong>{selectedShiftForAssign?.displayName}</strong>. Inspectors can only be assigned to one shift at a time.</p>
                
                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2 bg-gray-50">
                  {assignLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="animate-spin text-blue-600" size={24} />
                    </div>
                  ) : unassignedInspectors === null ? (
                    <div className="text-center py-4 text-gray-500 text-sm italic">Loading...</div>
                  ) : unassignedInspectors.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm italic">No available inspectors found. Either all are assigned or no inspectors exist.</div>
                  ) : (
                    unassignedInspectors?.map(ins => (
                      <label key={ins._id} className="flex items-center gap-3 p-3 bg-white border rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition">
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-blue-600"
                          checked={selectedInspectorIds.includes(ins._id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedInspectorIds([...selectedInspectorIds, ins._id]);
                            else setSelectedInspectorIds(selectedInspectorIds.filter(id => id !== ins._id));
                          }}
                        />
                        <div>
                          <div className="font-bold text-gray-900">{ins.firstName} {ins.lastName}</div>
                          <div className="text-xs text-gray-500">{ins.username}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignInspectors}
                    disabled={selectedInspectorIds.length === 0}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition disabled:opacity-50"
                  >
                    Assign Selected
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
