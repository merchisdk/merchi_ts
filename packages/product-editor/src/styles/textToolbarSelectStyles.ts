import { StylesConfig, OptionProps, SingleValueProps } from 'react-select';
import { FontOption } from '../config/fontConfig';

const isMobile = (): boolean => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 480;
  }
  return false;
};

export const customStyles: StylesConfig<FontOption, false> = {
  option: (provided, state: OptionProps<FontOption>) => ({
    ...provided,
    fontFamily: state.data.value,
    padding: '10px 15px',
    fontSize: '16px',
    backgroundColor: state.isFocused ? '#eee' : state.isSelected ? '#ddd' : 'white',
    color: '#333',
    cursor: 'pointer',
    transition: 'background-color 0.1s ease',
  }),
  control: (provided) => ({
    ...provided,
    minWidth: isMobile() ? 160 : 180,
    minHeight: 38,
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxShadow: 'none',
    backgroundColor: 'white',
    '&:hover': {
      borderColor: '#aaa'
    }
  }),
  singleValue: (provided, state: SingleValueProps<FontOption>) => ({
    ...provided,
    fontFamily: state.data.value,
    color: '#333',
    fontSize: isMobile() ? '13px' : '14px',
  }),
  input: (provided) => ({
    ...provided,
    margin: '0 2px',
    paddingTop: '1px',
    paddingBottom: '1px',
    fontFamily: 'sans-serif',
    color: '#333',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: '#888',
    fontFamily: 'sans-serif',
  }),
  menu: (provided) => ({
    ...provided,
    marginTop: '4px',
    border: '1px solid #ccc',
    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
    borderRadius: '4px',
  }),
}; 
