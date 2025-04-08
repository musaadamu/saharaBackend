import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { baseURL } from '../services/api';
import './JournalList.css';

// Log the API base URL for debugging
console.log('API Base URL:', baseURL);

const JournalList = () => {
    const navigate = useNavigate();
    const [journals, setJournals] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalJournals: 0
    });

    useEffect(() => {
        fetchJournals();
    }, []);

    const fetchJournals = async (page = 1) => {
        setLoading(true);
        setError('');
        try {
            // Verify auth token exists
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const { data } = await api.journals.getAll({ 
                page, 
                limit: 10, 
                sortBy: 'createdAt', 
                order: 'desc' 
            });
            setJournals(data.journals || []);
            setPagination(data.pagination || { currentPage: page, totalPages: 1, totalJournals: 0 });
        } catch (err) {
            const errorMsg = err.response?.status === 401 
                ? 'Session expired. Please login again.'
                : err.response?.data?.message || 'Failed to fetch journals';
            
            setError(errorMsg);
            toast.error(errorMsg);

            // Redirect to login if unauthorized
            if (err.response?.status === 401) {
                localStorage.removeItem('authToken');
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (id, fileType) => {
        try {
            const { data } = await api.journals.download(id, fileType);
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            const journal = journals.find(j => j._id === id);
            link.setAttribute('download', `${journal?.title || 'journal'}.${fileType}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(`Journal downloaded as ${fileType.toUpperCase()}`);
        } catch (err) {
            toast.error(`Failed to download ${fileType.toUpperCase()} file`);
        }
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;

    return (
        <div className="journal-list-container max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="header flex flex-col sm:flex-row justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 sm:mb-0">Journal List</h2>
                <Link 
                    to="/journals/new" 
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                    + New Journal
                </Link>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            {journals.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    <p className="text-lg">No journals available</p>
                    <p className="mt-2">Start by creating a new journal!</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {journals.map(({ _id, title, abstract, status }) => (
                            <div key={_id} className="journal-card border rounded-lg p-4 hover:shadow-md transition-shadow">
                                <h3 
                                    className="text-lg font-semibold text-blue-600 cursor-pointer hover:underline"
                                    onClick={() => navigate(`/journals/${_id}`)}
                                >
                                    {title}
                                </h3>
                                <p className="text-gray-600 mt-2 line-clamp-2">{abstract}</p>
                                <span 
                                    className={`status mt-2 px-2 py-1 rounded-full text-xs ${
                                        status === 'Published' 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-yellow-100 text-yellow-800'
                                    }`}
                                >
                                    {status}
                                </span>
                                <div className="actions mt-4 flex flex-wrap gap-2">
                                    <button 
                                        onClick={() => navigate(`/journals/${_id}`)} 
                                        className="text-blue-500 hover:text-blue-700"
                                    >
                                        View
                                    </button>
                                    <button 
                                        onClick={() => handleDownload(_id, 'pdf')} 
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        Download PDF
                                    </button>
                                    <button 
                                        onClick={() => handleDownload(_id, 'docx')} 
                                        className="text-blue-500 hover:text-blue-700"
                                    >
                                        Download DOCX
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="pagination flex justify-between items-center mt-6">
                        <button 
                            onClick={() => fetchJournals(pagination.currentPage - 1)} 
                            disabled={pagination.currentPage === 1} 
                            className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">
                            Page {pagination.currentPage} of {pagination.totalPages}
                        </span>
                        <button 
                            onClick={() => fetchJournals(pagination.currentPage + 1)} 
                            disabled={pagination.currentPage === pagination.totalPages} 
                            className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default JournalList;
