import * as React from 'react';
import {useState} from 'react';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {DateCalendar} from '@mui/x-date-pickers/DateCalendar';
import dayjs from 'dayjs';


export default function Cal() {
    const [selectedDate, setSelectedDate] = useState(null); // Initialize state to store selected date

    // Callback function to handle date selection
    const handleDateChange = (newDate) => {
        setSelectedDate(newDate);
        const formattedDate = dayjs(newDate).format('YYYY-MM-DD');
        const formattedDateWithSlashes = formattedDate.replace(/-/g, '/');
        // Trigger a full page reload by setting the new URL
        window.location.href = `/posts/${formattedDateWithSlashes}`;
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateCalendar
                onChange={handleDateChange} // Attach the callback function
                value={selectedDate} // Set the selected date (for controlled component)
            />
        </LocalizationProvider>
    );
}
