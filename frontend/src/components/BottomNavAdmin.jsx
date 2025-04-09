import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BuildingOffice2Icon, 
  MapPinIcon, 
  UserGroupIcon, 
  ClipboardDocumentListIcon 
} from '@heroicons/react/24/outline';

const BottomNavAdmin = () => {
  const navigate = useNavigate();

  const adminActions = [
    {
      name: 'Org Management',
      icon: BuildingOffice2Icon,
      path: '/organization'
    },
    {
      name: 'Locations',
      icon: MapPinIcon,
      path: '/locations'
    },
    {
      name: 'Crew Tracking',
      icon: UserGroupIcon,
      path: '/crew-tracking'
    },
    {
      name: 'Assignments',
      icon: ClipboardDocumentListIcon,
      path: '/manage-assignments'
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg z-50 md:hidden">
      <div className="grid grid-cols-4 divide-x divide-gray-200 dark:divide-gray-700">
        {adminActions.map((action) => (
          <button
            key={action.name}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center justify-center py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <action.icon className="h-6 w-6 text-gray-600 dark:text-gray-300 mb-1" />
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {action.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BottomNavAdmin;
