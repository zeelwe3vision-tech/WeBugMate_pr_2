import React, { useState } from 'react';
import CalendarPicker from '../../components/CalendarPicker';

const CalendarExample = () => {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        console.log('Selected date:', date);
    };

    const formatDate = (date) => {
        if (!date) return 'No date selected';
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <h2>Calendar Picker Example</h2>

            <button
                onClick={() => setIsCalendarOpen(true)}
                style={{
                    padding: '12px 24px',
                    fontSize: '16px',
                    borderRadius: '8px',
                    border: '1px solid #a855f7',
                    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600'
                }}
            >
                Open Calendar
            </button>

            {selectedDate && (
                <div style={{ marginTop: '20px', fontSize: '18px', color: '#f4c7d9' }}>
                    <strong>Selected:</strong> {formatDate(selectedDate)}
                </div>
            )}

            <CalendarPicker
                isOpen={isCalendarOpen}
                onClose={() => setIsCalendarOpen(false)}
                onSelect={handleDateSelect}
                initialDate={selectedDate || new Date()}
            />
        </div>
    );
};

export default CalendarExample;
