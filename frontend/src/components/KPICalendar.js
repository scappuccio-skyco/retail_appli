import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function KPICalendar({ selectedDate, onDateChange, datesWithData = [] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const buttonRef = React.useRef(null);

  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dayNames = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'];

  // Format date as YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check if a date has data
  const hasData = (dateStr) => {
    return datesWithData.includes(dateStr);
  };

  // Get days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
    let firstDayOfWeek = firstDay.getDay();
    // Convert to Monday = 0, Sunday = 6
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleDayClick = (day) => {
    if (day) {
      const newDate = new Date(year, month, day);
      const formattedDate = formatDate(newDate);
      onDateChange(formattedDate);
      setIsOpen(false);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    const formattedDate = formatDate(today);
    onDateChange(formattedDate);
    setIsOpen(false);
  };

  const isSelectedDay = (day) => {
    if (!day) return false;
    const dayDate = formatDate(new Date(year, month, day));
    return dayDate === selectedDate;
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() && 
           month === today.getMonth() && 
           year === today.getFullYear();
  };

  // Format selected date for display
  const displayDate = () => {
    const date = new Date(selectedDate);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  // Check if calendar should open upwards
  const handleToggleCalendar = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Calendar height is approximately 400px, open upwards if not enough space below
      setOpenUpwards(spaceBelow < 400 && spaceAbove > spaceBelow);
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      {/* Date display button */}
      <button
        ref={buttonRef}
        onClick={handleToggleCalendar}
        className="px-3 py-1.5 text-sm border-2 border-gray-300 rounded-lg hover:border-purple-400 focus:border-purple-400 focus:outline-none cursor-pointer bg-white font-medium text-gray-700 min-w-[140px] text-left flex items-center justify-between"
      >
        <span>📅 {displayDate()}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Calendar popup */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Calendar */}
          <div 
            className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 p-3 z-[9999] min-w-[280px]"
            style={{
              top: openUpwards ? 'auto' : buttonRef.current?.getBoundingClientRect().bottom + 8 + 'px',
              bottom: openUpwards ? window.innerHeight - (buttonRef.current?.getBoundingClientRect().top - 8) + 'px' : 'auto',
              left: buttonRef.current?.getBoundingClientRect().left + 'px'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              
              <div className="text-xs font-bold text-gray-800">
                {monthNames[month]} {year}
              </div>
              
              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-1 mb-1 text-xs">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const dayDate = day ? formatDate(new Date(year, month, day)) : null;
                const dataExists = day && hasData(dayDate);
                const selected = isSelectedDay(day);
                const today = isToday(day);

                return (
                  <button
                    key={index}
                    onClick={() => handleDayClick(day)}
                    disabled={!day}
                    className={`
                      relative h-7 text-xs rounded-md transition-all
                      ${!day ? 'invisible' : ''}
                      ${selected ? 'bg-purple-600 text-white font-bold ring-2 ring-purple-400 ring-offset-1' : ''}
                      ${!selected && today ? 'border-2 border-purple-600 font-bold text-purple-600' : ''}
                      ${!selected && !today && dataExists ? 'bg-green-100 text-green-800 font-semibold hover:bg-green-200' : ''}
                      ${!selected && !today && !dataExists ? 'text-gray-700 hover:bg-gray-100' : ''}
                    `}
                  >
                    {day}
                    {dataExists && !selected && (
                      <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2">
                        <div className="w-1 h-1 bg-green-600 rounded-full"></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend & Actions */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between gap-2 text-xs text-gray-600 mb-2">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-100 rounded border border-green-300"></div>
                  <span>: Données</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-purple-600 rounded"></div>
                  <span>: N/D</span>
                </div>
              </div>
              <button
                onClick={handleToday}
                className="w-full px-3 py-1.5 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-full px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors font-medium mt-1"
              >
                Effacer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
