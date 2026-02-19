import React, { useState, useEffect } from 'react';
import './CalendarPicker.css';

const CalendarPicker = ({ isOpen, onClose, onSelect, initialDate = new Date(), minDate = null }) => {
    const [currentDate, setCurrentDate] = useState(initialDate);
    const [selectedDay, setSelectedDay] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setCurrentDate(initialDate);
            setSelectedDay(null);
        }
    }, [isOpen, initialDate]);

    // Helper function to check if a date is before or equal to minDate
    const isDateDisabled = (date) => {
        if (!minDate) return false;

        // Set time to midnight for accurate date comparison
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        const minDateCopy = new Date(minDate);
        minDateCopy.setHours(0, 0, 0, 0);

        // End date must be AFTER start date (not on the same day)
        return checkDate <= minDateCopy;
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();

        const rows = [];
        let days = [];

        // Add previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = prevMonthDays - i;
            days.push(
                <div key={`prev-${day}`} className="day other-month">
                    {day}
                </div>
            );
        }

        // Add current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dayDate = new Date(year, month, d);
            const isSelected = selectedDay &&
                selectedDay.getDate() === d &&
                selectedDay.getMonth() === month &&
                selectedDay.getFullYear() === year;

            const isDisabled = isDateDisabled(dayDate);

            days.push(
                <div
                    key={d}
                    className={`day ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && setSelectedDay(dayDate)}
                    style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                >
                    {d}
                </div>
            );

            // Create a new row every 7 days
            if (days.length === 7) {
                rows.push(
                    <div key={`row-${rows.length}`} className="days-row">
                        {days}
                    </div>
                );
                days = [];
            }
        }

        // Add next month days to complete the last row
        if (days.length > 0) {
            let nextDay = 1;
            while (days.length < 7) {
                days.push(
                    <div key={`next-${nextDay}`} className="day other-month">
                        {nextDay}
                    </div>
                );
                nextDay++;
            }
            rows.push(
                <div key={`row-${rows.length}`} className="days-row">
                    {days}
                </div>
            );
        }

        return rows;
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    };

    const handlePrevYear = () => {
        setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth()));
    };

    const handleNextYear = () => {
        setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth()));
    };

    const handleChoose = () => {
        if (selectedDay && onSelect) {
            onSelect(selectedDay);
        }
        if (onClose) {
            onClose();
        }
    };

    const monthLabel = currentDate.toLocaleString('default', { month: 'short' });
    const yearLabel = currentDate.getFullYear();

    if (!isOpen) return null;

    return (
        <div className="calendar-overlay" onClick={onClose}>
            <div className="calendar-card" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="calendar-header">
                    <span>Pick a Date</span>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Date Picker */}
                <div className="calendar-date-picker">
                    {/* Selection Row */}
                    <div className="calendar-nav">
                        {/* Month dropdown */}
                        <div className="month-dropdown">
                            <button className="prev" onClick={handlePrevMonth} aria-label="Previous month"></button>
                            <span className="month-label">{monthLabel}</span>
                            <button className="next" onClick={handleNextMonth} aria-label="Next month"></button>
                        </div>

                        {/* Year dropdown */}
                        <div className="year-dropdown">
                            <button className="prev" onClick={handlePrevYear} aria-label="Previous year"></button>
                            <span className="year-label">{yearLabel}</span>
                            <button className="next" onClick={handleNextYear} aria-label="Next year"></button>
                        </div>
                    </div>

                    {/* Calendar grid */}
                    <div className="calendar-grid">
                        <div className="calendar-grid-inner">
                            {/* Day names */}
                            <div className="day-names">
                                <div className="day-name">Su</div>
                                <div className="day-name">Mo</div>
                                <div className="day-name">Tu</div>
                                <div className="day-name">We</div>
                                <div className="day-name">Th</div>
                                <div className="day-name">Fr</div>
                                <div className="day-name">Sa</div>
                            </div>

                            {/* Days container */}
                            <div className="days-container">
                                {renderCalendar()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Choose button */}
                <button
                    className="choose-btn"
                    onClick={handleChoose}
                    disabled={!selectedDay}
                >
                    <div className="choose-btn-inner">
                        <span>Choose</span>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default CalendarPicker;
